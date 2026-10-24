import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { InventoryMovementsService } from '../../../core/services/inventory-movements';
import { ProductsService } from '../../../core/services/products';
import { SuppliersService } from '../../../core/services/suppliers';
import { CompanyContextService } from '../../../core/services/company-context';
import { Product } from '../../../core/models/product.model';
import { Supplier } from '../../../core/models/supplier.model';

const PRODUCTS_PAGE_SIZE = 200;

@Component({
  selector: 'app-movement-form-modal',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './movement-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private movementsService = inject(InventoryMovementsService);
  private productsService = inject(ProductsService);
  private suppliersService = inject(SuppliersService);
  private companyContext = inject(CompanyContextService);

  close = output<void>();
  saved = output<'In' | 'Out'>();

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  products = signal<Product[]>([]);
  suppliers = signal<Supplier[]>([]);

  // El endpoint rechaza con 400 (MultiWarehouseNotSupportedException) a
  // cualquier empresa con usesMultiWarehouse activado — no hay forma de
  // "elegir bien" el almacén acá, el flujo entero no aplica todavía.
  blockedByMultiWarehouse = computed(() => this.companyContext.company()?.settings.usesMultiWarehouse === true);
  usesLots = computed(() => this.companyContext.company()?.settings.usesLots === true);

  today = new Date().toISOString().slice(0, 10);

  form = this.fb.group({
    date: [this.today, Validators.required],
    movementType: ['In' as 'In' | 'Out', Validators.required],
    productId: ['', Validators.required],
    unitOfMeasureId: [''],
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    unitCost: [null as number | null],
    lotOrSerial: [''],
    supplierId: [''],
    notes: [''],
  });

  ngOnInit(): void {
    if (this.blockedByMultiWarehouse()) {
      this.loading.set(false);
      return;
    }

    forkJoin({
      products: this.productsService.list(1, PRODUCTS_PAGE_SIZE, { isActive: true, tracksStock: true }),
      suppliers: this.suppliersService.list({ isActive: true }),
    }).subscribe({
      next: ({ products, suppliers }) => {
        this.products.set(products.items);
        this.suppliers.set(suppliers);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar productos/proveedores.');
        this.loading.set(false);
      },
    });

    // Precarga la unidad de medida del producto elegido.
    this.form.controls.productId.valueChanges.subscribe(productId => {
      const product = this.products().find(p => p.id === productId);
      this.form.controls.unitOfMeasureId.setValue(product?.unitOfMeasureId ?? '');
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
        unitCost: value.unitCost,
        lotOrSerial: this.usesLots() ? value.lotOrSerial || null : null,
        supplierId: value.supplierId || null,
        notes: value.notes || null,
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
