import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { LotCodeField } from '../../../shared/lot-code-field/lot-code-field';
import { PurchasesService } from '../../../core/services/purchases';
import { ProductsService } from '../../../core/services/products';
import { LotsService } from '../../../core/services/lots';
import { SuppliersService } from '../../../core/services/suppliers';
import { WarehousesService } from '../../../core/services/warehouses';
import { CompanyContextService } from '../../../core/services/company-context';
import { Product } from '../../../core/models/product.model';
import { Supplier } from '../../../core/models/supplier.model';
import { Warehouse } from '../../../core/models/warehouse.model';
import { Purchase, SavePurchaseRequest } from '../../../core/models/purchase.model';

const PRODUCTS_PAGE_SIZE = 200;

interface ItemSeed {
  id?: string | null;
  productId: string;
  unitOfMeasureId: string;
  quantity: number;
  unitCost: number;
  lotOrSerial?: string | null;
}

// Shape real de itemsArray.getRawValue() — newItemGroup() más abajo define
// exactamente estos controles.
interface ItemFormValue {
  id: string | null;
  productId: string;
  unitOfMeasureId: string;
  quantity: number;
  unitCost: number;
  lotOrSerial: string;
}

@Component({
  selector: 'app-purchase-form-modal',
  imports: [ReactiveFormsModule, Modal, LotCodeField],
  templateUrl: './purchase-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private purchasesService = inject(PurchasesService);
  private productsService = inject(ProductsService);
  private lotsService = inject(LotsService);
  private suppliersService = inject(SuppliersService);
  private warehousesService = inject(WarehousesService);
  private companyContext = inject(CompanyContextService);

  // null/omitido = alta. Con id = edición de esa compra (solo si está Pending).
  purchaseId = input<string | null>(null);
  close = output<void>();
  saved = output<Purchase>();

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  products = signal<Product[]>([]);
  suppliers = signal<Supplier[]>([]);
  warehouses = signal<Warehouse[]>([]);

  usesMultiWarehouse = computed(() => this.companyContext.company()?.settings.usesMultiWarehouse === true);
  usesLots = computed(() => this.companyContext.company()?.settings.usesLots !== false);

  today = new Date().toISOString().slice(0, 10);

  form = this.fb.group({
    date: [this.today, Validators.required],
    supplierId: ['', Validators.required],
    warehouseId: [''],
    discount: [0, [Validators.min(0)]],
    notes: [''],
    items: this.fb.array<FormGroup>([]),
  });

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  ngOnInit(): void {
    forkJoin({
      // Una compra puede ser de cualquier tipo de producto, no solo materia prima.
      products: this.productsService.list(1, PRODUCTS_PAGE_SIZE, { isActive: true }),
      suppliers: this.suppliersService.list({ isActive: true }),
      warehouses: this.warehousesService.list({ isActive: true }),
    }).subscribe({
      next: ({ products, suppliers, warehouses }) => {
        this.products.set(products.items);
        this.suppliers.set(suppliers);
        this.warehouses.set(warehouses);

        const id = this.purchaseId();
        if (id) {
          this.loadPurchase(id);
        } else {
          this.addItem();
          this.loading.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar productos/proveedores/almacenes.');
        this.loading.set(false);
      },
    });
  }

  private loadPurchase(id: string) {
    this.purchasesService.get(id).subscribe({
      next: purchase => {
        this.form.patchValue({
          date: purchase.date?.slice(0, 10) ?? this.today,
          supplierId: purchase.supplierId,
          warehouseId: purchase.warehouseId ?? '',
          discount: purchase.discount,
          notes: purchase.notes ?? '',
        });

        for (const item of purchase.items) {
          this.addItem({
            id: item.id,
            productId: item.productId,
            unitOfMeasureId: item.unitOfMeasureId ?? '',
            quantity: item.quantity,
            unitCost: item.unitCost,
            lotOrSerial: item.lotOrSerial,
          });
        }

        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la compra.');
        this.loading.set(false);
      },
    });
  }

  private newItemGroup(seed?: ItemSeed): FormGroup {
    return this.fb.group({
      id: [seed?.id ?? null],
      productId: [seed?.productId ?? '', Validators.required],
      unitOfMeasureId: [seed?.unitOfMeasureId ?? ''],
      quantity: [seed?.quantity ?? 1, [Validators.required, Validators.min(0.0001)]],
      unitCost: [seed?.unitCost ?? 0, [Validators.required, Validators.min(0)]],
      lotOrSerial: [seed?.lotOrSerial ?? '', Validators.maxLength(40)],
    });
  }

  addItem(seed?: ItemSeed) {
    this.itemsArray.push(this.newItemGroup(seed));
  }

  removeItem(index: number) {
    this.itemsArray.removeAt(index);
  }

  generatingLotIndex = signal<number | null>(null);

  // (change) del <select> — solo dispara con interacción real del usuario,
  // nunca con el patchValue de loadPurchase(), así que no pisa el lote ya
  // cargado al editar una compra existente.
  onProductChange(index: number) {
    const group = this.itemsArray.at(index);
    const product = this.products().find(p => p.id === group.get('productId')!.value);
    group.get('unitOfMeasureId')!.setValue(product?.unitOfMeasureId ?? '');

    if (this.usesLots() && product) {
      this.generatingLotIndex.set(index);
      this.lotsService.next('Mp', product.id).subscribe({
        next: res => {
          this.generatingLotIndex.set(null);
          group.get('lotOrSerial')!.setValue(res.lotCode);
        },
        error: () => {
          this.generatingLotIndex.set(null);
          // no bloquea el form — el usuario puede escribir el lote a mano
        },
      });
    }
  }

  lineTotal(index: number): number {
    const group = this.itemsArray.at(index);
    const quantity = Number(group.get('quantity')!.value) || 0;
    const unitCost = Number(group.get('unitCost')!.value) || 0;
    return quantity * unitCost;
  }

  subtotal(): number {
    return this.itemsArray.controls.reduce((sum: number, group) => {
      const quantity = Number(group.get('quantity')!.value) || 0;
      const unitCost = Number(group.get('unitCost')!.value) || 0;
      return sum + quantity * unitCost;
    }, 0);
  }

  total(): number {
    const discount = Number(this.form.controls.discount.value) || 0;
    return Math.max(0, this.subtotal() - discount);
  }

  submit() {
    if (this.itemsArray.length === 0) {
      this.errorMessage.set('Agrega al menos un ítem a la compra.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const id = this.purchaseId();

    const payload: SavePurchaseRequest = {
      date: value.date!,
      warehouseId: this.usesMultiWarehouse() ? value.warehouseId || null : null,
      supplierId: value.supplierId!,
      discount: value.discount ?? 0,
      notes: value.notes || null,
      items: (value.items as unknown as ItemFormValue[]).map(item => ({
        // En alta no se manda id — solo en edición (id presente = actualiza, null = línea nueva).
        ...(id ? { id: item.id ?? null } : {}),
        productId: item.productId,
        variantId: null,
        unitOfMeasureId: item.unitOfMeasureId || null,
        quantity: item.quantity,
        unitCost: item.unitCost,
        lotOrSerial: item.lotOrSerial || null,
      })),
    };

    const request = id ? this.purchasesService.update(id, payload) : this.purchasesService.create(payload);

    request.subscribe({
      next: purchase => this.saved.emit(purchase),
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
    return 'Ocurrió un error al guardar la compra.';
  }
}
