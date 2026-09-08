import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { InventoryMovementsService } from '../../../core/services/inventory-movements';
import { ProductsService } from '../../../core/services/products';
import { CompanyContextService } from '../../../core/services/company-context';
import { Product } from '../../../core/models/product.model';

const PRODUCTS_PAGE_SIZE = 200;

@Component({
  selector: 'app-movement-adjustment-modal',
  imports: [ReactiveFormsModule, Modal],
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

  selectedProduct = computed(() => this.products().find(p => p.id === this.form.controls.productId.value));

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

    this.form.controls.productId.valueChanges.subscribe(productId => {
      const product = this.products().find(p => p.id === productId);
      this.form.controls.unitOfMeasureId.setValue(product?.unitOfMeasureId ?? '');
      if (product) {
        this.form.controls.newStock.setValue(product.currentStock);
      }
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
        notes: value.notes || null,
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
    return 'Ocurrió un error al registrar el ajuste.';
  }
}
