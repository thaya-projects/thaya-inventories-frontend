import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Modal } from '../../../shared/modal/modal';
import { ProductPicker } from '../../../shared/product-picker/product-picker';
import { InventoryMovementsService } from '../../../core/services/inventory-movements';
import { ProductsService } from '../../../core/services/products';
import { CompanyContextService } from '../../../core/services/company-context';
import { Product } from '../../../core/models/product.model';

const PRODUCTS_PAGE_SIZE = 200;

@Component({
  selector: 'app-movement-adjustment-modal',
  imports: [ReactiveFormsModule, Modal, ProductPicker],
  templateUrl: './movement-adjustment-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementAdjustmentModal implements OnInit {
  private fb = inject(FormBuilder);
  private movementsService = inject(InventoryMovementsService);
  private productsService = inject(ProductsService);
  private companyContext = inject(CompanyContextService);

  close = output<void>();
  saved = output<void>();

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  products = signal<Product[]>([]);

  // Confirmado: /adjustment comparte InventoryStockService.ApplyMovementAsync
  // con POST /inventory-movements, así que hereda el mismo 400
  // (MultiWarehouseNotSupportedException) si usesMultiWarehouse está activado.
  blockedByMultiWarehouse = computed(() => this.companyContext.company()?.settings.usesMultiWarehouse === true);

  today = new Date().toISOString().slice(0, 10);

  form = this.fb.group({
    date: [this.today, Validators.required],
    productId: ['', Validators.required],
    unitOfMeasureId: [''],
    newStock: [0, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  // El producto elegido en el buscador (puede no estar entre los precargados).
  selectedProduct = signal<Product | null>(null);
  private counted = toSignal(this.form.controls.newStock.valueChanges, { initialValue: this.form.controls.newStock.value });

  // Contado − sistema: lo que el conteo corrige.
  difference = computed(() => {
    const p = this.selectedProduct();
    const counted = Number(this.counted());
    if (!p || this.counted() === null || Number.isNaN(counted)) return null;
    return Math.round((counted - p.currentStock) * 1000) / 1000;
  });

  onProductPicked(product: Product) {
    this.selectedProduct.set(product);
    this.form.patchValue({
      productId: product.id,
      unitOfMeasureId: product.unitOfMeasureId ?? '',
      newStock: product.currentStock,
    });
    this.errorMessage.set(null);
  }

  ngOnInit(): void {
    if (this.blockedByMultiWarehouse()) {
      this.loading.set(false);
      return;
    }

    this.productsService.list(1, PRODUCTS_PAGE_SIZE, { isActive: true, tracksStock: true }).subscribe({
      next: products => {
        this.products.set(products.items);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los productos.');
        this.loading.set(false);
      },
    });

  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.productId.invalid) this.errorMessage.set('Elige el producto que contaste.');
      return;
    }
    if (this.difference() === 0) {
      this.errorMessage.set('El conteo coincide con el sistema: no hay nada que corregir.');
      return;
    }

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.movementsService
      .adjust({
        date: value.date!,
        warehouseId: null,
        productId: value.productId!,
        variantId: null,
        unitOfMeasureId: value.unitOfMeasureId || null,
        newStock: value.newStock!,
        notes: value.notes?.trim() ? `Conteo físico: ${value.notes.trim()}` : 'Conteo físico',
      })
      .subscribe({
        next: () => this.saved.emit(),
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
    return 'No se pudo guardar el conteo. Intenta nuevamente.';
  }
}
