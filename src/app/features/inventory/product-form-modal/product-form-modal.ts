import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
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

// Aplana el árbol de categorías con indentación por profundidad, igual que en category-form.
function flattenCategories(categories: Category[], depth = 0): SelectOption[] {
  return categories.flatMap(c => [
    { id: c.id, label: `${'— '.repeat(depth)}${c.name}` },
    ...flattenCategories(c.children, depth + 1),
  ]);
}

const UNITS_PAGE_SIZE = 200;

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Datos básicos', 'Inventario y precio', 'Atributos', 'Imágenes'];

// El paso 4 (Imágenes) no tiene campos de formulario — se gestiona aparte, contra un id real.
const STEP_FIELDS: Record<Exclude<WizardStep, 4>, string[]> = {
  1: ['code', 'name', 'productType', 'categoryId', 'unitOfMeasureId'],
  2: ['minimumStock', 'salePrice', 'shelfLifeMonths'],
  3: ['attributesJson'],
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
  private toast = inject(ToastService);

  // null/omitido = alta. Con id = edición de ese producto.
  productId = input<string | null>(null);
  close = output<void>();
  saved = output<Product>();

  stepLabels = STEP_LABELS;
  productTypes = PRODUCT_TYPES;

  // Id "vivo": arranca en productId() si es edición, y se completa al crear
  // (recién ahí existe un id real contra el cual subir imágenes).
  currentProductId = signal<string | null>(null);

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

  form = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    description: [''],
    productType: ['Finished' as ProductType, Validators.required],
    categoryId: [''],
    unitOfMeasureId: [''],
    tracksStock: [true],
    hasVariants: [false],
    minimumStock: [0, [Validators.required, Validators.min(0)]],
    salePrice: [null as number | null],
    shelfLifeMonths: [null as number | null],
    attributesJson: ['{}'],
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
          shelfLifeMonths: product.shelfLifeMonths,
          attributesJson: JSON.stringify(product.attributes ?? {}, null, 2),
        });
        // hasVariants no se puede cambiar después de creado (no va en el PUT).
        this.form.controls.hasVariants.disable();
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
    if (step === 4) return;

    const fields = STEP_FIELDS[step];
    const hasInvalid = fields.some(name => this.form.get(name)!.invalid);

    if (hasInvalid) {
      fields.forEach(name => this.form.get(name)!.markAsTouched());
      return;
    }

    this.step.update(s => (s < 3 ? ((s + 1) as WizardStep) : s));
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

  // Guarda los datos (paso 1-3) y avanza al paso de imágenes — alta o
  // edición, según si ya existe un id real.
  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const brokenStep = ([1, 2, 3] as const).find(s => STEP_FIELDS[s].some(name => this.form.get(name)!.invalid));
      if (brokenStep) this.step.set(brokenStep);
      return;
    }

    const value = this.form.getRawValue();

    let attributes: Record<string, unknown> = {};
    if (value.attributesJson?.trim()) {
      try {
        attributes = JSON.parse(value.attributesJson);
      } catch {
        this.errorMessage.set('El campo "Atributos" debe ser un JSON válido.');
        this.step.set(3);
        return;
      }
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
      minimumStock: value.minimumStock!,
      salePrice: value.salePrice,
      shelfLifeMonths: value.shelfLifeMonths,
      attributes,
    };

    const id = this.currentProductId();
    const request = id
      ? this.productsService.update(id, basePayload)
      : this.productsService.create({ ...basePayload, hasVariants: value.hasVariants! });

    request.subscribe({
      next: product => {
        this.submitting.set(false);
        this.currentProductId.set(product.id);
        this.form.controls.hasVariants.disable();
        this.saved.emit(product);
        this.step.set(4);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
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
