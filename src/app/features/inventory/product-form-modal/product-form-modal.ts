import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, catchError, concat, debounceTime, distinctUntilChanged, forkJoin, last, map, of, switchMap, toArray } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Modal } from '../../../shared/modal/modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ProductsService } from '../../../core/services/products';
import { CategoriesService } from '../../../core/services/categories';
import { UnitsOfMeasureService } from '../../../core/services/units-of-measure';
import { ProductImagesService } from '../../../core/services/product-images';
import { InventoryMovementsService } from '../../../core/services/inventory-movements';
import { CompanyContextService } from '../../../core/services/company-context';
import { Product, ProductType } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, ProductImage } from '../../../core/models/product-image.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { generateProductCode } from '../../../shared/product-code-generator';
import { InfoHint } from '../../../shared/info-hint/info-hint';
import { DateRangeField } from '../../../shared/date-range-field/date-range-field';

// Explicación corta de para qué sirve cada atributo del producto (ícono "i").
export const PRODUCT_FIELD_HINTS = {
  name: 'Cómo se llama el producto en ventas, compras y reportes. No puede repetirse dentro de tu empresa.',
  code: 'Identificador corto y único (SKU). Sirve para buscar rápido y para etiquetas o códigos de barras.',
  description: 'Detalle opcional: presentación, sabor, tamaño, etc. Se muestra en el catálogo.',
  productType: 'Terminado: se vende tal cual. Materia prima: insumo para producir. Kit: combo de productos. Servicio: no tiene stock físico. Consumible: se gasta en la operación.',
  categoryId: 'Agrupa productos para filtrarlos y ver reportes por familia (ej. Bebidas, Limpieza).',
  unitOfMeasureId: 'En qué se cuenta el stock: unidades, kg, litros, cajas… Se usa en compras, ventas y movimientos.',
  tracksStock: 'Si está activo, cada venta, compra o ajuste mueve el stock. Desactívalo para servicios o productos que no inventarías.',
  hasVariants: 'Actívalo si el producto viene en versiones (talla, color, sabor) que manejas por separado.',
  minimumStock: 'Cantidad mínima que quieres tener. Cuando el stock llega a este número, el producto se marca en ámbar y recibes una alerta para reponer.',
  salePrice: 'Precio al que vendes normalmente. Se propone automáticamente al crear una venta.',
  shelfLifeMonths: 'Cuántos meses dura el producto desde que se fabrica o recibe. Sirve de referencia para controlar vencimientos.',
  discountPrice: 'Precio promocional que se muestra en el catálogo en lugar del precio normal mientras el descuento esté activo.',
  discountDates: 'Rango opcional en el que aplica el descuento. Sin fechas, queda activo hasta que lo quites.',
} as const;

interface SelectOption {
  id: string;
  label: string;
}

// Foto elegida pero todavía no subida: se sube al guardar (en alta aún no hay id).
interface PendingImage {
  key: string;
  file: File;
  preview: string;
}

// Una foto de la galería, ya subida o pendiente. key: id real o "pending-N".
export interface GalleryItem {
  key: string;
  url: string;
  pending: boolean;
}

// Con pocas categorías se eligen con un toque (chips); con muchas, con un select.
const CATEGORY_CHIPS_MAX = 10;

// Ejemplos de nombre de distintos rubros: Thaya sirve para cualquier inventario.
const NAME_EXAMPLES = [
  'Ej. Mouse inalámbrico Logitech M170',
  'Ej. Ron Abuelo Añejo 750 ml',
  'Ej. Polera algodón básica',
  'Ej. Martillo de uña 16 oz',
  'Ej. Shampoo Sedal 340 ml',
  'Ej. Pelota de fútbol N°5',
];

// Características que más se repiten entre rubros; cualquier otra se escribe a mano.
const ATTRIBUTE_SUGGESTIONS = ['Marca', 'Modelo', 'Color', 'Talla', 'Material', 'Contenido', 'Garantía'];

interface AttributeRow {
  id: number;
  key: string;
  value: string;
}
const MAX_PHOTOS = 8;

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'Finished', label: 'Terminado' },
  { value: 'RawMaterial', label: 'Materia prima' },
  { value: 'Service', label: 'Servicio' },
  { value: 'Kit', label: 'Kit' },
  { value: 'Consumable', label: 'Consumible' },
];

// app-date-range-field (igual que datetime-local) trabaja en hora local sin offset — Date lo
// interpreta/emite igual (local), así que el round-trip con toISOString() da
// la hora correcta sin manipular el offset a mano.
function toDatetimeLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Fecha de hoy en hora local (toISOString daría mañana por la noche en Bolivia).
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromDatetimeLocalInput(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

// Aplana el árbol de categorías con indentación por profundidad, igual que en category-form.
function flattenCategories(categories: Category[], depth = 0): SelectOption[] {
  return categories.flatMap(c => [
    { id: c.id, label: `${'— '.repeat(depth)}${c.name}` },
    ...flattenCategories(c.children, depth + 1),
  ]);
}

const UNITS_PAGE_SIZE = 200;

@Component({
  selector: 'app-product-form-modal',
  imports: [ReactiveFormsModule, NgTemplateOutlet, Modal, ConfirmDialog, InfoHint, DateRangeField],
  templateUrl: './product-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private productsService = inject(ProductsService);
  private categoriesService = inject(CategoriesService);
  private unitsService = inject(UnitsOfMeasureService);
  private productImagesService = inject(ProductImagesService);
  private companyContext = inject(CompanyContextService);
  private toast = inject(ToastService);
  private movementsService = inject(InventoryMovementsService);
  private destroyRef = inject(DestroyRef);

  // null/omitido = alta. Con id = edición de ese producto.
  productId = input<string | null>(null);
  close = output<void>();
  saved = output<Product>();

  hints = PRODUCT_FIELD_HINTS;
  maxPhotos = MAX_PHOTOS;
  namePlaceholder = NAME_EXAMPLES[Math.floor(Math.random() * NAME_EXAMPLES.length)];

  // Características (Marca, Procesador, Graduación…): se ven en la ficha de la tienda.
  attributes = signal<AttributeRow[]>([]);
  private attributeSeq = 0;
  attributeSuggestions = computed(() => {
    const used = new Set(this.attributes().map(a => a.key.trim().toLowerCase()));
    return ATTRIBUTE_SUGGESTIONS.filter(s => !used.has(s.toLowerCase()));
  });
  private unitsRaw: { id: string; code: string; name: string; abbreviation: string | null }[] = [];

  // Fábrica: tipo y unidad importan (materia prima, kg, litros). Tienda: casi
  // siempre un producto terminado por unidad, así que van en "Más opciones".
  isFactory = computed(() => this.companyContext.company()?.settings.usesProduction === true);
  showMore = signal(false);
  showDiscount = signal(false);
  // Descuento, destacado y características solo se ven en la landing pública. Sin landing no
  // se muestran (lo ya guardado se conserva: el formulario los sigue enviando tal cual).
  hasStore = computed(() => this.companyContext.company()?.settings.hasPublicStorefront === true);
  editingCode = signal(false);
  categoryAsChips = computed(() => this.categoryOptions().length <= CATEGORY_CHIPS_MAX);

  // Aviso temprano de nombre repetido (el backend igual lo bloquea con 409).
  duplicateName = signal<string | null>(null);
  private nameCheck$ = new Subject<string>();

  // Id "vivo": arranca en productId() si es edición, y se completa al crear
  // (recién ahí existe un id real contra el cual subir imágenes).
  currentProductId = signal<string | null>(null);
  // Al editar: stock y costo promedio actuales (se cambian con movimientos, no aquí).
  currentStock = signal<number | null>(null);
  averageCost = signal<number | null>(null);
  // Al editar: 'add' suma lo que llegó (entrada), 'set' corrige al conteo real (ajuste). Se aplica al guardar.
  stockMode = signal<'none' | 'add' | 'set'>('none');

  // Empresas que solo compran y venden (sin producción) no manejan materia
  // prima/servicios/consumibles como productos propios — en alta se les
  // oculta todo salvo Terminado/Kit. En edición se muestran todos por si el
  // producto ya tenía otro tipo (ej. la empresa cambió de paquete después).
  productTypes = computed<{ value: ProductType; label: string }[]>(() => {
    if (this.currentProductId()) return PRODUCT_TYPES;
    const usesProduction = this.companyContext.company()?.settings.usesProduction === true;
    return usesProduction ? PRODUCT_TYPES : PRODUCT_TYPES.filter(t => t.value === 'Finished' || t.value === 'Kit');
  });

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);
  categoryOptions = signal<SelectOption[]>([]);
  unitOptions = signal<SelectOption[]>([]);

  images = signal<ProductImage[]>([]);
  imagesLoading = signal(false);
  uploading = signal(false);
  deletingImageId = signal<string | null>(null);
  settingPrimaryId = signal<string | null>(null);
  imageError = signal<string | null>(null);
  deleteImageTarget = signal<ProductImage | null>(null);
  dragging = signal(false);
  pending = signal<PendingImage[]>([]);
  // Foto pendiente elegida como principal (si es una ya subida, se marca al instante).
  pendingPrimary = signal<string | null>(null);
  private pendingSeq = 0;

  // Fotos ya subidas + pendientes, la principal primero.
  gallery = computed<GalleryItem[]>(() => {
    const items: GalleryItem[] = [
      ...this.images().map(i => ({ key: i.id, url: i.url, pending: false })),
      ...this.pending().map(p => ({ key: p.key, url: p.preview, pending: true })),
    ];
    const primary = this.primaryKey();
    return [...items.filter(i => i.key === primary), ...items.filter(i => i.key !== primary)];
  });

  primaryKey = computed<string | null>(() => {
    const chosen = this.pendingPrimary();
    if (chosen && this.pending().some(p => p.key === chosen)) return chosen;
    return this.images().find(i => i.isPrimary)?.id ?? this.images()[0]?.id ?? this.pending()[0]?.key ?? null;
  });

  // Mientras no toquen el campo Código a mano, se autocompleta a partir del
  // Nombre — solo en alta; en edición no tocamos el código de un producto ya creado.
  codeManuallyEdited = signal(false);

  // Producto destacado: no hay "desmarcar", solo "marcar" — al hacerlo, el
  // backend desmarca solo al anterior.
  isFeatured = signal(false);
  featureOnSave = signal(false);

  // Si la empresa no produce, lo normal al dar de alta es un producto
  // terminado que se compra y vende tal cual; si produce, lo normal es
  // materia prima que luego se transforma.
  private defaultProductType(): ProductType {
    return this.companyContext.company()?.settings.usesProduction === true ? 'RawMaterial' : 'Finished';
  }

  // La vida útil solo tiene sentido para lo que vence (fábricas de alimentos, etc.).
  private defaultShelfLife(): number | null {
    return this.companyContext.company()?.settings.usesProduction === true ? 12 : null;
  }

  form = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    description: [''],
    productType: [this.defaultProductType(), Validators.required],
    categoryId: [''],
    unitOfMeasureId: [''],
    tracksStock: [true],
    hasVariants: [false],
    minimumStock: [0, [Validators.required, Validators.min(0)]],
    // Solo al crear: lo que ya tiene en mano. Se guarda como una entrada de stock (igual que la importación).
    initialStock: [null as number | null, Validators.min(0)],
    unitCost: [null as number | null, Validators.min(0)],
    salePrice: [null as number | null],
    discountPrice: [null as number | null],
    discountStartsAt: [''],
    discountEndsAt: [''],
    shelfLifeMonths: [this.defaultShelfLife() as number | null],
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.pending().forEach(p => URL.revokeObjectURL(p.preview)));
  }

  ngOnInit(): void {
    this.currentProductId.set(this.productId());

    this.nameCheck$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(name => (name.length < 2 ? of(null) : this.productsService.list(1, 20, { search: name }))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        const typed = (this.form.controls.name.value ?? '').trim().toLowerCase();
        const match = result?.items.find(
          p => p.id !== this.currentProductId() && p.name.trim().toLowerCase() === typed,
        );
        this.duplicateName.set(match ? `${match.name} (${match.code})` : null);
      });

    this.form.controls.name.valueChanges.subscribe(name => {
      this.nameCheck$.next((name ?? '').trim());
      if (this.currentProductId() || this.codeManuallyEdited()) return;
      this.form.controls.code.setValue(generateProductCode(name ?? ''), { emitEvent: false });
    });

    forkJoin({
      categories: this.categoriesService.list(true, { isActive: true }),
      units: this.unitsService.list(1, UNITS_PAGE_SIZE, { isActive: true }),
    }).subscribe({
      next: ({ categories, units }) => {
        this.categoryOptions.set(flattenCategories(categories));
        this.unitsRaw = units.items.map(u => ({ id: u.id, code: u.code, name: u.name, abbreviation: u.abbreviation ?? null }));
        this.unitOptions.set(units.items.map(u => ({ id: u.id, label: `${u.name} (${u.abbreviation ?? u.code})` })));

        const id = this.currentProductId();
        if (id) {
          this.loadProduct(id);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar categorías/unidades.');
        this.loading.set(false);
      },
    });
  }

  private loadProduct(id: string) {
    this.productsService.get(id).subscribe({
      next: product => {
        this.form.patchValue({
          code: product.code,
          name: product.name,
          description: product.description ?? '',
          productType: product.productType,
          categoryId: product.categoryId ?? '',
          unitOfMeasureId: product.unitOfMeasureId ?? '',
          tracksStock: product.tracksStock,
          hasVariants: product.hasVariants,
          minimumStock: product.minimumStock,
          salePrice: product.salePrice,
          discountPrice: product.discountPrice,
          discountStartsAt: toDatetimeLocalInput(product.discountStartsAt),
          discountEndsAt: toDatetimeLocalInput(product.discountEndsAt),
          shelfLifeMonths: product.shelfLifeMonths,
        });
        this.isFeatured.set(product.isFeatured);
        this.currentStock.set(product.currentStock);
        this.averageCost.set(product.averageCost);
        this.attributes.set(
          Object.entries(product.attributes ?? {}).map(([key, value]) => ({
            id: ++this.attributeSeq,
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
          })),
        );
        this.showDiscount.set(product.discountPrice !== null);
        this.showMore.set(
          product.hasVariants || (!this.isFactory() && (product.productType !== 'Finished' || !product.tracksStock)),
        );
        this.loading.set(false);
        this.loadImages(id);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el producto.');
        this.loading.set(false);
      },
    });
  }

  private loadImages(productId: string) {
    this.imagesLoading.set(true);
    this.productImagesService.list(productId).subscribe({
      next: images => {
        this.images.set(images);
        this.imagesLoading.set(false);
      },
      error: () => {
        this.imageError.set('No se pudieron cargar las imágenes.');
        this.imagesLoading.set(false);
      },
    });
  }

  // Precio con descuento → "−20 %" para que se vea cuánto se rebaja.
  discountLabel(): string | null {
    const price = Number(this.form.controls.salePrice.value);
    const discount = Number(this.form.controls.discountPrice.value);
    if (!price || !discount || discount >= price) return null;
    return `−${Math.round((1 - discount / price) * 100)} %`;
  }

  // Descuento con fecha "Hasta" ya pasada: sigue guardado pero no se aplica.
  discountEnded(): boolean {
    const end = this.form.controls.discountEndsAt.value;
    return !!end && new Date(end).getTime() < Date.now();
  }

  toggleDiscount() {
    if (this.showDiscount()) {
      this.form.patchValue({ discountPrice: null, discountStartsAt: '', discountEndsAt: '' });
    }
    this.showDiscount.update(v => !v);
  }

  addAttribute(key = '') {
    this.attributes.update(list => [...list, { id: ++this.attributeSeq, key, value: '' }]);
    // Foco en el campo recién agregado: el valor si ya trae nombre, si no el nombre.
    const id = this.attributeSeq;
    setTimeout(() => document.getElementById(`attr-${key ? 'value' : 'key'}-${id}`)?.focus());
  }

  updateAttribute(id: number, field: 'key' | 'value', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.attributes.update(list => list.map(a => (a.id === id ? { ...a, [field]: value } : a)));
  }

  removeAttribute(id: number) {
    this.attributes.update(list => list.filter(a => a.id !== id));
  }

  private attributesPayload(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const a of this.attributes()) {
      const key = a.key.trim();
      const value = a.value.trim();
      if (key && value) result[key] = value;
    }
    return result;
  }

  // "Unidades (por defecto)" de verdad: sin unidad, el producto no podría mover stock.
  private defaultUnitId(): string | null {
    const isUnit = (v: string | null) => ['und', 'unidad', 'unidades', 'u', 'un', 'pza', 'pieza'].includes((v ?? '').trim().toLowerCase());
    return this.unitsRaw.find(u => isUnit(u.abbreviation) || isUnit(u.code) || isUnit(u.name))?.id ?? null;
  }

  // Abreviatura de la unidad elegida (o "u") para mostrar junto a la cantidad.
  unitLabel(): string {
    const id = this.form.controls.unitOfMeasureId.value || this.defaultUnitId();
    const unit = this.unitsRaw.find(u => u.id === id);
    return unit?.abbreviation || unit?.code || 'u';
  }

  startStockEdit(mode: 'add' | 'set') {
    this.stockMode.set(mode);
    this.form.patchValue({ initialStock: mode === 'set' ? this.currentStock() : null, unitCost: null });
  }

  cancelStockEdit() {
    this.stockMode.set('none');
    this.form.patchValue({ initialStock: null, unitCost: null });
  }

  // "Quedarás con 12 und" / "Pasa de 5 a 7 und (+2)".
  stockPreview(): string | null {
    const raw = this.form.controls.initialStock.value;
    if (raw === null || (raw as unknown) === '') return null;
    const qty = Number(raw);
    const now = this.currentStock() ?? 0;
    const unit = this.unitLabel();
    if (this.stockMode() === 'add') return qty > 0 ? `Quedarás con ${now + qty} ${unit}.` : null;
    const diff = qty - now;
    if (diff === 0) return 'Es lo mismo que ya tienes.';
    return `Pasa de ${now} a ${qty} ${unit} (${diff > 0 ? '+' : ''}${diff}).`;
  }

  // Stock a la vista solo si el producto se cuenta y no va por variantes (cada variante tiene el suyo).
  asksStock(): boolean {
    return this.form.controls.tracksStock.value === true && this.form.controls.hasVariants.value !== true;
  }

  // "Ganas Bs 40.00 por unidad (40 %)" con el costo que puso (o el promedio, al editar).
  marginHint(): { text: string; loss: boolean } | null {
    const price = Number(this.form.controls.salePrice.value);
    const cost = this.currentProductId() ? Number(this.averageCost()) : Number(this.form.controls.unitCost.value);
    if (!price || !cost) return null;
    const gain = price - cost;
    if (gain < 0) return { text: `Vendes Bs ${(-gain).toFixed(2)} por debajo del costo.`, loss: true };
    return { text: `Ganas Bs ${gain.toFixed(2)} por unidad (${Math.round((gain / price) * 100)} %).`, loss: false };
  }

  pickCategory(id: string) {
    this.form.controls.categoryId.setValue(this.form.controls.categoryId.value === id ? '' : id);
  }

  onFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  private addFiles(files: File[]) {
    this.imageError.set(null);
    const room = MAX_PHOTOS - this.gallery().length;
    const accepted: PendingImage[] = [];

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
        this.imageError.set('Usa fotos JPG, PNG o WebP.');
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        this.imageError.set(`«${file.name}» pesa más de 5 MB. Prueba con una más liviana.`);
        continue;
      }
      if (accepted.length >= room) {
        this.imageError.set(`Hasta ${MAX_PHOTOS} fotos por producto.`);
        break;
      }
      accepted.push({ key: `pending-${++this.pendingSeq}`, file, preview: URL.createObjectURL(file) });
    }

    if (accepted.length) this.pending.update(list => [...list, ...accepted]);
  }

  // Principal: si la foto ya está subida (edición) se marca al instante; si es
  // pendiente, se sube como principal al guardar.
  makePrimary(item: GalleryItem) {
    if (item.key === this.primaryKey()) return;
    if (item.pending) {
      this.pendingPrimary.set(item.key);
      return;
    }
    const id = this.currentProductId();
    if (!id) return;
    this.pendingPrimary.set(null);
    this.settingPrimaryId.set(item.key);
    this.productImagesService.setPrimary(id, item.key).subscribe({
      next: () => {
        this.settingPrimaryId.set(null);
        this.images.update(list => list.map(i => ({ ...i, isPrimary: i.id === item.key })));
      },
      error: (err: HttpErrorResponse) => {
        this.settingPrimaryId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
  }

  removeItem(item: GalleryItem) {
    if (item.pending) {
      const target = this.pending().find(p => p.key === item.key);
      if (target) URL.revokeObjectURL(target.preview);
      this.pending.update(list => list.filter(p => p.key !== item.key));
      if (this.pendingPrimary() === item.key) this.pendingPrimary.set(null);
      return;
    }
    const image = this.images().find(i => i.id === item.key);
    if (image) this.deleteImageTarget.set(image);
  }

  // Sube las fotos pendientes en orden; la principal va marcada como tal.
  private uploadPending(productId: string): Observable<unknown> {
    const list = this.pending();
    if (!list.length) return of(null);
    const primary = this.primaryKey();
    const base = this.images().length;
    return concat(
      ...list.map((p, i) => this.productImagesService.upload(productId, p.file, p.key === primary, base + i)),
    ).pipe(toArray());
  }

  askDeleteImage(image: ProductImage) {
    this.deleteImageTarget.set(image);
  }

  closeDeleteImageConfirm() {
    if (this.deletingImageId()) return;
    this.deleteImageTarget.set(null);
  }

  confirmDeleteImage() {
    const image = this.deleteImageTarget();
    const id = this.currentProductId();
    if (!image || !id) return;

    this.deletingImageId.set(image.id);
    this.productImagesService.delete(id, image.id).subscribe({
      next: () => {
        this.deletingImageId.set(null);
        this.deleteImageTarget.set(null);
        this.images.update(list => list.filter(i => i.id !== image.id));
        // Si era la principal, el backend no elige otra: se marca la siguiente.
        if (image.isPrimary && this.images().length) this.makePrimary({ key: this.images()[0].id, url: '', pending: false });
      },
      error: (err: HttpErrorResponse) => {
        this.deletingImageId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
  }

  // Guarda los datos, después sube las fotos nuevas y, si se pidió, lo destaca.
  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.code.invalid) this.editingCode.set(true);
      if (this.form.controls.minimumStock.invalid || this.form.controls.productType.invalid) this.showMore.set(true);
      return;
    }

    const value = this.form.getRawValue();

    const discountStartsAt = fromDatetimeLocalInput(value.discountStartsAt ?? '');
    const discountEndsAt = fromDatetimeLocalInput(value.discountEndsAt ?? '');
    if (discountStartsAt && discountEndsAt && discountEndsAt <= discountStartsAt) {
      this.errorMessage.set('El fin del descuento tiene que ser después del inicio.');
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);

    const basePayload = {
      code: value.code!,
      name: value.name!,
      description: value.description || null,
      productType: value.productType!,
      categoryId: value.categoryId || null,
      unitOfMeasureId: value.unitOfMeasureId || this.defaultUnitId(),
      tracksStock: value.tracksStock!,
      hasVariants: value.hasVariants!,
      minimumStock: value.minimumStock!,
      salePrice: value.salePrice,
      discountPrice: value.discountPrice,
      discountStartsAt,
      discountEndsAt,
      shelfLifeMonths: value.shelfLifeMonths,
      attributes: this.attributesPayload(),
    };

    const id = this.currentProductId();
    const request = id ? this.productsService.update(id, basePayload) : this.productsService.create(basePayload);
    // Movimiento de stock que acompaña al guardado: entrada al crear o al "Agregar", ajuste al "Corregir".
    const qty = Number(value.initialStock) || 0;
    const hasQty = value.initialStock !== null && (value.initialStock as unknown) !== '';
    const mode = id ? this.stockMode() : 'add';
    const stockOp: 'in' | 'set' | null = !this.asksStock() ? null
      : mode === 'add' && qty > 0 ? 'in'
      : mode === 'set' && hasQty && qty !== this.currentStock() ? 'set'
      : null;
    let stockFailed = false;

    let savedProduct: Product | null = null;

    request
      .pipe(
        switchMap(product => {
          savedProduct = product;
          // Si después falla una foto, el reintento actualiza en vez de crear otro (y no repite el stock).
          this.currentProductId.set(product.id);
          if (!stockOp) return of(null);
          // El movimiento exige unidad (el producto no): sin unidad no se puede mover stock.
          const unitOfMeasureId = product.unitOfMeasureId ?? basePayload.unitOfMeasureId;
          if (!unitOfMeasureId) { stockFailed = true; return of(null); }
          const common = { date: localToday(), warehouseId: null, productId: product.id, variantId: null, unitOfMeasureId };
          const op$ = stockOp === 'in'
            ? this.movementsService.create({
                ...common, movementType: 'In', quantity: qty, unitCost: value.unitCost ?? null,
                lotOrSerial: null, supplierId: null, notes: id ? 'Entrada desde la ficha del producto' : 'Stock inicial',
              })
            : this.movementsService.adjust({ ...common, newStock: qty, notes: 'Corrección desde la ficha del producto' });
          return op$.pipe(
            // Ya aplicado: un reintento (p. ej. por una foto) no lo repite.
            map(() => {
              this.currentStock.set(stockOp === 'in' ? (this.currentStock() ?? 0) + qty : qty);
              this.stockMode.set('none');
              this.form.patchValue({ initialStock: null, unitCost: null });
              return null;
            }),
            catchError(() => { stockFailed = true; return of(null); }),
          );
        }),
        switchMap(() => this.uploadPending(savedProduct!.id)),
        switchMap(() =>
          this.featureOnSave() && !this.isFeatured() ? this.productsService.feature(savedProduct!.id) : of(null),
        ),
        last(),
        map(() => savedProduct!),
      )
      .subscribe({
        next: product => {
          this.submitting.set(false);
          if (stockFailed) this.toast.error('El producto se guardó, pero no se pudo actualizar el stock. Revisa que tenga unidad (Más opciones → Se cuenta en) o hazlo desde Movimientos.');
          this.saved.emit(product);
          this.close.emit();
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          if (savedProduct) {
            // Los datos quedaron guardados; recargar fotos para ver cuáles subieron.
            this.pending().forEach(p => URL.revokeObjectURL(p.preview));
            this.pending.set([]);
            this.loadImages(savedProduct.id);
            this.errorMessage.set(`El producto se guardó, pero una foto no se pudo subir: ${this.mapError(err)}`);
          } else {
            this.errorMessage.set(this.mapError(err));
          }
        },
      });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al guardar. Intenta nuevamente.';
  }
}
