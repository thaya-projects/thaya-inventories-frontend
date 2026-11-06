import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { InventoryMovementsService } from '../../../core/services/inventory-movements';
import { ProductsService } from '../../../core/services/products';
import { CompanyContextService } from '../../../core/services/company-context';
import { Product } from '../../../core/models/product.model';
import { RouterLink } from '@angular/router';
import { ProductPicker } from '../../../shared/product-picker/product-picker';

// Movimiento manual = lo que NO es venta ni compra (esas mueven el stock solas).
// El motivo se elige con un toque y queda escrito en las notas del movimiento.
const REASONS: Record<'In' | 'Out', { value: string; label: string }[]> = {
  Out: [
    { value: 'Se dañó o rompió', label: 'Se dañó o rompió' },
    { value: 'Se perdió o lo robaron', label: 'Se perdió / robo' },
    { value: 'Venció', label: 'Venció' },
    { value: 'Regalo o muestra', label: 'Regalo o muestra' },
    { value: 'Uso interno', label: 'Uso interno' },
    { value: 'Otro motivo', label: 'Otro' },
  ],
  In: [
    { value: 'Devolución de un cliente', label: 'Devolución de cliente' },
    { value: 'Sobrante encontrado', label: 'Apareció / sobrante' },
    { value: 'Nos lo regalaron', label: 'Nos lo regalaron' },
    { value: 'Otro motivo', label: 'Otro' },
  ],
};
const PRODUCTS_PAGE_SIZE = 200;

@Component({
  selector: 'app-movement-form-modal',
  imports: [ReactiveFormsModule, Modal, RouterLink, ProductPicker],
  templateUrl: './movement-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private movementsService = inject(InventoryMovementsService);
  private productsService = inject(ProductsService);
  private companyContext = inject(CompanyContextService);

  close = output<void>();
  saved = output<'In' | 'Out'>();

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  products = signal<Product[]>([]);
  selectedProduct = signal<Product | null>(null);
  reasons = REASONS;
  reason = signal('');

  // El endpoint rechaza con 400 (MultiWarehouseNotSupportedException) a
  // cualquier empresa con usesMultiWarehouse activado — no hay forma de
  // "elegir bien" el almacén acá, el flujo entero no aplica todavía.
  blockedByMultiWarehouse = computed(() => this.companyContext.company()?.settings.usesMultiWarehouse === true);
  usesLots = computed(() => this.companyContext.company()?.settings.usesLots === true);

  today = new Date().toISOString().slice(0, 10);

  form = this.fb.group({
    date: [this.today, Validators.required],
    movementType: ['Out' as 'In' | 'Out', Validators.required],
    productId: ['', Validators.required],
    unitOfMeasureId: [''],
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    unitCost: [null as number | null],
    lotOrSerial: [''],
    notes: [''],
  });

  ngOnInit(): void {
    if (this.blockedByMultiWarehouse()) {
      this.loading.set(false);
      return;
    }

    this.productsService.list(1, PRODUCTS_PAGE_SIZE, { isActive: true, tracksStock: true }).subscribe({
      next: res => {
        this.products.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los productos.');
        this.loading.set(false);
      },
    });

    // Al cambiar de entrada a salida, el motivo elegido ya no aplica.
    this.form.controls.movementType.valueChanges.subscribe(() => this.reason.set(''));
  }

  type = () => this.form.controls.movementType.value ?? 'In';

  onProductPicked(product: Product) {
    this.selectedProduct.set(product);
    this.form.controls.productId.setValue(product.id);
    this.form.controls.unitOfMeasureId.setValue(product.unitOfMeasureId ?? '');
  }

  // Stock que quedaría: lo que más ayuda a no equivocarse de cantidad.
  stockAfter(): number | null {
    const p = this.selectedProduct();
    const qty = Number(this.form.controls.quantity.value) || 0;
    if (!p) return null;
    return this.type() === 'In' ? p.currentStock + qty : p.currentStock - qty;
  }

  submit() {
    if (this.form.invalid || !this.reason()) {
      this.form.markAllAsTouched();
      if (!this.reason()) this.errorMessage.set('Elige por qué entra o sale el producto.');
      return;
    }

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.movementsService
      .create({
        date: value.date!,
        // Siempre null: el endpoint solo funciona sin multi-almacén, así que
        // el backend usa el único almacén (default) que existe en ese caso.
        warehouseId: null,
        productId: value.productId!,
        variantId: null,
        unitOfMeasureId: value.unitOfMeasureId || null,
        movementType: value.movementType!,
        quantity: value.quantity!,
        // En una salida el costo lo pone el sistema (costo promedio); solo se pide en entradas.
        unitCost: value.movementType === 'In' ? value.unitCost : null,
        lotOrSerial: this.usesLots() ? value.lotOrSerial || null : null,
        supplierId: null,
        notes: [this.reason(), value.notes?.trim()].filter(Boolean).join(': '),
      })
      .subscribe({
        next: () => this.saved.emit(value.movementType!),
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
    return 'Ocurrió un error al registrar el movimiento.';
  }
}
