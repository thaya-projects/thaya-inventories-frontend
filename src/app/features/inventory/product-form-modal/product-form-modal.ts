import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { WizardStepper } from '../../../shared/wizard-stepper/wizard-stepper';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ProductsService } from '../../../core/services/products';
import { CategoriesService } from '../../../core/services/categories';
import { UnitsOfMeasureService } from '../../../core/services/units-of-measure';
import { ProductImagesService } from '../../../core/services/product-images';
import { CompanyContextService } from '../../../core/services/company-context';
import { Product, ProductType } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, ProductImage } from '../../../core/models/product-image.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { generateProductCode } from '../../../shared/product-code-generator';

interface SelectOption {
  id: string;
  label: string;
}

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'Finished', label: 'Terminado' },
  { value: 'RawMaterial', label: 'Materia prima' },
  { value: 'Service', label: 'Servicio' },
  { value: 'Kit', label: 'Kit' },
  { value: 'Consumable', label: 'Consumible' },
];

// <input type="datetime-local"> trabaja en hora local sin offset — Date lo
// interpreta/emite igual (local), así que el round-trip con toISOString() da
// la hora correcta sin manipular el offset a mano.
function toDatetimeLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

type WizardStep = 1 | 2 | 3;

const STEP_LABELS = ['Datos básicos', 'Inventario y precio', 'Imágenes'];

// El paso 3 (Imágenes) no tiene campos de formulario — se gestiona aparte, contra un id real.
const STEP_FIELDS: Record<Exclude<WizardStep, 3>, string[]> = {
  1: ['code', 'name', 'productType', 'categoryId', 'unitOfMeasureId'],
  2: ['minimumStock', 'salePrice', 'shelfLifeMonths'],
};

@Component({
  selector: 'app-product-form-modal',
  imports: [ReactiveFormsModule, Modal, WizardStepper, ConfirmDialog],
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

  // null/omitido = alta. Con id = edición de ese producto.
  productId = input<string | null>(null);
  close = output<void>();
  saved = output<Product>();

  stepLabels = STEP_LABELS;

  // Id "vivo": arranca en productId() si es edición, y se completa al crear
  // (recién ahí existe un id real contra el cual subir imágenes).
  currentProductId = signal<string | null>(null);

  // Empresas que solo compran y venden (sin producción) no manejan materia
  // prima/servicios/consumibles como productos propios — en alta se les
  // oculta todo salvo Terminado/Kit. En edición se muestran todos por si el
  // producto ya tenía otro tipo (ej. la empresa cambió de paquete después).
  productTypes = computed<{ value: ProductType; label: string }[]>(() => {
    if (this.currentProductId()) return PRODUCT_TYPES;
    const usesProduction = this.companyContext.company()?.settings.usesProduction === true;
    return usesProduction ? PRODUCT_TYPES : PRODUCT_TYPES.filter(t => t.value === 'Finished' || t.value === 'Kit');
  });

  step = signal<WizardStep>(1);
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
  selectedFile = signal<File | null>(null);
  newImageIsPrimary = signal(false);
  imageError = signal<string | null>(null);
  deleteImageTarget = signal<ProductImage | null>(null);

  // Mientras no toquen el campo Código a mano, se autocompleta a partir del
  // Nombre — solo en alta; en edición no tocamos el código de un producto ya creado.
  codeManuallyEdited = signal(false);

  // Producto destacado: no hay "desmarcar", solo "marcar" — al hacerlo, el
  // backend desmarca solo al anterior.
  isFeatured = signal(false);
  featuring = signal(false);

  // Si la empresa no produce, lo normal al dar de alta es un producto
  // terminado que se compra y vende tal cual; si produce, lo normal es
  // materia prima que luego se transforma.
  private defaultProductType(): ProductType {
    return this.companyContext.company()?.settings.usesProduction === true ? 'RawMaterial' : 'Finished';
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
    salePrice: [null as number | null],
    discountPrice: [null as number | null],
    discountStartsAt: [''],
    discountEndsAt: [''],
    shelfLifeMonths: [12 as number | null],
  });

  ngOnInit(): void {
    this.currentProductId.set(this.productId());

    this.form.controls.name.valueChanges.subscribe(name => {
      if (this.currentProductId() || this.codeManuallyEdited()) return;
      this.form.controls.code.setValue(generateProductCode(name ?? ''), { emitEvent: false });
    });

    forkJoin({
      categories: this.categoriesService.list(true, { isActive: true }),
      units: this.unitsService.list(1, UNITS_PAGE_SIZE, { isActive: true }),
    }).subscribe({
      next: ({ categories, units }) => {
        this.categoryOptions.set(flattenCategories(categories));
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

  next() {
    const step = this.step();
    if (step === 3) return;

    const fields = STEP_FIELDS[step];
    const hasInvalid = fields.some(name => this.form.get(name)!.invalid);

    if (hasInvalid) {
      fields.forEach(name => this.form.get(name)!.markAsTouched());
      return;
    }

    this.step.update(s => (s < 2 ? ((s + 1) as WizardStep) : s));
  }

  back() {
    this.step.update(s => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.imageError.set(null);

    if (!file) {
      this.selectedFile.set(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      this.imageError.set('Solo se permiten imágenes JPEG, PNG o WEBP.');
      this.selectedFile.set(null);
      input.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      this.imageError.set('El archivo supera el tamaño máximo permitido de 5 MB.');
      this.selectedFile.set(null);
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
  }

  uploadImage() {
    const file = this.selectedFile();
    const id = this.currentProductId();
    if (!file || !id) return;

    this.uploading.set(true);
    this.imageError.set(null);

    this.productImagesService.upload(id, file, this.newImageIsPrimary(), this.images().length).subscribe({
      next: () => {
        this.uploading.set(false);
        this.selectedFile.set(null);
        this.newImageIsPrimary.set(false);
        this.toast.success('Imagen subida.');
        this.loadImages(id);
      },
      error: (err: HttpErrorResponse) => {
        this.uploading.set(false);
        this.imageError.set(this.mapError(err));
      },
    });
  }

  setPrimaryImage(image: ProductImage) {
    const id = this.currentProductId();
    if (!id) return;

    this.settingPrimaryId.set(image.id);
    this.productImagesService.setPrimary(id, image.id).subscribe({
      next: () => {
        this.settingPrimaryId.set(null);
        this.loadImages(id);
      },
      error: (err: HttpErrorResponse) => {
        this.settingPrimaryId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
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
      },
      error: (err: HttpErrorResponse) => {
        this.deletingImageId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
  }

  // Guarda los datos (paso 1-2) y avanza al paso de imágenes — alta o
  // edición, según si ya existe un id real.
  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const brokenStep = ([1, 2] as const).find(s => STEP_FIELDS[s].some(name => this.form.get(name)!.invalid));
      if (brokenStep) this.step.set(brokenStep);
      return;
    }

    const value = this.form.getRawValue();

    const discountStartsAt = fromDatetimeLocalInput(value.discountStartsAt ?? '');
    const discountEndsAt = fromDatetimeLocalInput(value.discountEndsAt ?? '');
    if (discountStartsAt && discountEndsAt && discountEndsAt <= discountStartsAt) {
      this.errorMessage.set('La fecha "Hasta" del descuento debe ser posterior a "Desde".');
      this.step.set(2);
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
      unitOfMeasureId: value.unitOfMeasureId || null,
      tracksStock: value.tracksStock!,
      hasVariants: value.hasVariants!,
      minimumStock: value.minimumStock!,
      salePrice: value.salePrice,
      discountPrice: value.discountPrice,
      discountStartsAt,
      discountEndsAt,
      shelfLifeMonths: value.shelfLifeMonths,
    };

    const id = this.currentProductId();
    const request = id ? this.productsService.update(id, basePayload) : this.productsService.create(basePayload);

    request.subscribe({
      next: product => {
        this.submitting.set(false);
        this.currentProductId.set(product.id);
        this.saved.emit(product);
        this.step.set(3);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
      },
    });
  }

  markAsFeatured() {
    const id = this.currentProductId();
    if (!id || this.isFeatured()) return;

    this.featuring.set(true);
    this.productsService.feature(id).subscribe({
      next: () => {
        this.featuring.set(false);
        this.isFeatured.set(true);
        this.toast.success('Producto marcado como destacado.');
      },
      error: (err: HttpErrorResponse) => {
        this.featuring.set(false);
        this.toast.error(this.mapError(err));
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
