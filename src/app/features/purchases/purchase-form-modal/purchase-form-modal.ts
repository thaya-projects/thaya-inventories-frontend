import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Modal } from '../../../shared/modal/modal';
import { LotCodeField } from '../../../shared/lot-code-field/lot-code-field';
import { ProductPicker } from '../../../shared/product-picker/product-picker';
import { PaymentMethodsService } from '../../../core/services/payment-methods';
import { PurchasePaymentsService } from '../../../core/services/purchase-payments';
import { PaymentMethod, paymentMethodLabel } from '../../../core/models/payment-method.model';

type PayMode = 'full' | 'partial' | 'credit';
type ReceiveMode = 'now' | 'later';
import { PurchasesService } from '../../../core/services/purchases';
import { ProductsService } from '../../../core/services/products';
import { LotsService } from '../../../core/services/lots';
import { SuppliersService } from '../../../core/services/suppliers';
import { WarehousesService } from '../../../core/services/warehouses';
import { CompanyContextService } from '../../../core/services/company-context';
import { Product } from '../../../core/models/product.model';
import { Supplier } from '../../../core/models/supplier.model';
import { Warehouse } from '../../../core/models/warehouse.model';
import { LastPurchaseCost, LastPurchaseCostItem, Purchase, SavePurchaseRequest } from '../../../core/models/purchase.model';

// Por debajo de este margen sobre el precio de venta se avisa "ganas poco".
const LOW_MARGIN = 0.15;
// Si el producto nunca tuvo precio/costo de referencia, se sugiere vender un 30% sobre el costo.
const DEFAULT_MARKUP = 1.3;

export interface MarginCheck {
  salePrice: number;
  profit: number;
  pct: number;
  level: 'loss' | 'low' | 'ok';
}

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
  imports: [ReactiveFormsModule, Modal, LotCodeField, DatePipe, ProductPicker],
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
  private destroyRef = inject(DestroyRef);

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

  // Último costo pagado y precio de venta por producto, para controlar subas del proveedor.
  costInfo = signal<Record<string, LastPurchaseCost>>({});

  // Tienda (no fábrica), compra nueva: se recibe y se paga en el momento, como en el mostrador.
  private paymentMethodsService = inject(PaymentMethodsService);
  private purchasePaymentsService = inject(PurchasePaymentsService);
  isFactory = computed(() => this.companyContext.company()?.settings?.usesProduction === true);
  receiveMode = signal<ReceiveMode>('now');
  payMode = signal<PayMode>('full');
  payMethodId = signal('');
  payAmount = signal(0);
  paymentMethods = signal<PaymentMethod[]>([]);

  isDirectFlow(): boolean {
    return !this.isFactory() && !this.purchaseId();
  }

  showPayment(): boolean {
    return this.isDirectFlow() && this.paymentMethods().length > 0;
  }

  methodLabel = (m: PaymentMethod) => paymentMethodLabel(m, this.paymentMethods());

  setPayMode(mode: PayMode) {
    this.payMode.set(mode);
    if (mode === 'partial' && !this.payAmount()) this.payAmount.set(Math.round((this.total() / 2) * 100) / 100);
  }

  onPayAmountInput(event: Event) {
    this.payAmount.set(Math.max(0, Number((event.target as HTMLInputElement).value) || 0));
  }

  paidNow(total = this.total()): number {
    if (!this.showPayment() || !this.payMethodId()) return 0;
    if (this.payMode() === 'full') return total;
    if (this.payMode() === 'partial') return Math.min(this.payAmount(), total);
    return 0;
  }

  // Un solo estilo de selección en toda la ventana: lo elegido en verde oscuro, como los filtros de la app.
  segClass(active: boolean): string {
    return active
      ? 'bg-gr-primary-dark text-gr-primary-lite'
      : 'bg-gr-surface text-gr-sub ring-1 ring-gr-border ring-inset hover:text-gr-text';
  }

  showDiscount = signal(false);
  editingLot = signal<number | null>(null);

  // Lo que va a pasar al guardar, en una frase (se muestra en el pie junto al botón).
  outcome(): string {
    if (!this.isDirectFlow()) return '';
    const received = this.receiveMode() === 'now' ? 'Entra al stock ahora' : 'Queda por recibir';
    if (!this.showPayment()) return received;
    const method = this.paymentMethods().find(m => m.id === this.payMethodId());
    const label = method ? this.methodLabel(method).toLowerCase() : '';
    if (this.payMode() === 'credit') return `${received} · debes Bs ${this.total().toFixed(2)}`;
    if (this.payMode() === 'partial') return `${received} · debes Bs ${(this.total() - this.paidNow()).toFixed(2)}`;
    return `${received} · pagada${label ? ' en ' + label : ''}`;
  }

  submitLabel(): string {
    if (this.purchaseId()) return 'Guardar cambios';
    if (!this.isDirectFlow()) return 'Crear compra';
    return this.receiveMode() === 'now' ? 'Registrar compra' : 'Guardar pedido';
  }
  // Producto cuyo precio de venta se está corrigiendo desde la compra.
  editingPriceFor = signal<string | null>(null);
  newSalePrice = signal(0);
  savingPrice = signal(false);
  showNotes = signal(false);

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  ngOnInit(): void {
    if (!this.purchaseId()) {
      this.paymentMethodsService.list({ isActive: true }).subscribe({
        next: list => {
          this.paymentMethods.set(list);
          this.payMethodId.set((list.find(m => m.type === 'Cash') ?? list[0])?.id ?? '');
        },
        error: () => {},
      });
    }

    // Otro proveedor → otra referencia de "lo último que le pagaste". No pisa costos ya escritos.
    this.form.controls.supplierId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      for (const id of this.lineProductIds()) this.fetchCost(id, false);
    });

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

        for (const productId of this.lineProductIds()) this.fetchCost(productId, false);
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

  productFor(index: number): Product | null {
    const id = this.itemsArray.at(index).get('productId')!.value;
    return this.products().find(p => p.id === id) ?? null;
  }

  // Elegido desde el buscador: puede venir de la búsqueda en el servidor (no estar en la lista cargada).
  onProductPicked(index: number, product: Product) {
    if (!this.products().some(p => p.id === product.id)) this.products.update(list => [...list, product]);
    const group = this.itemsArray.at(index);
    // Otro producto en la misma línea: su costo se vuelve a sugerir desde cero.
    if (group.get('productId')!.value && group.get('productId')!.value !== product.id) group.get('unitCost')!.setValue(0);
    group.get('productId')!.setValue(product.id);
    group.get('productId')!.markAsTouched();
    this.onProductChange(index);
  }

  // (change) del <select> — solo dispara con interacción real del usuario,
  // nunca con el patchValue de loadPurchase(), así que no pisa el lote ya
  // cargado al editar una compra existente.
  onProductChange(index: number) {
    const group = this.itemsArray.at(index);
    const product = this.products().find(p => p.id === group.get('productId')!.value);
    group.get('unitOfMeasureId')!.setValue(product?.unitOfMeasureId ?? '');
    if (product) this.fetchCost(product.id, true, index);

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

  private lineProductIds(): string[] {
    return [...new Set(this.itemsArray.controls.map(g => g.get('productId')!.value as string).filter(Boolean))];
  }

  // prefill: al elegir el producto, el costo se llena con lo último pagado (si la línea está en 0).
  private fetchCost(productId: string, prefill: boolean, index?: number) {
    this.purchasesService.lastCost(productId, this.form.controls.supplierId.value || null).subscribe({
      next: info => {
        this.costInfo.update(map => ({ ...map, [productId]: info }));
        if (prefill && index != null) {
          const costCtrl = this.itemsArray.at(index)?.get('unitCost');
          const ref = info.lastFromSupplier ?? info.last;
          const suggested = ref?.unitCost ?? (info.averageCost > 0 ? info.averageCost : 0);
          if (costCtrl && !Number(costCtrl.value) && suggested > 0) costCtrl.setValue(Math.round(suggested * 100) / 100);
        }
      },
      // Sin referencia no se bloquea nada: solo no se muestran los avisos.
      error: () => {},
    });
  }

  private lineCost(index: number): number {
    return Number(this.itemsArray.at(index).get('unitCost')!.value) || 0;
  }

  private lineInfo(index: number): LastPurchaseCost | null {
    const productId = this.itemsArray.at(index).get('productId')!.value as string;
    return productId ? this.costInfo()[productId] ?? null : null;
  }

  // Referencia para comparar: lo último que le pagaste a este proveedor, o lo último a cualquiera.
  reference(index: number): LastPurchaseCostItem | null {
    const info = this.lineInfo(index);
    return info?.lastFromSupplier ?? info?.last ?? null;
  }

  // % de cambio del costo escrito contra la última compra (null si no hay con qué comparar).
  costChange(index: number): number | null {
    const ref = this.reference(index);
    const cost = this.lineCost(index);
    if (!ref || ref.unitCost <= 0 || cost <= 0) return null;
    const pct = ((cost - ref.unitCost) / ref.unitCost) * 100;
    return Math.abs(pct) < 0.5 ? 0 : pct;
  }

  marginCheck(index: number): MarginCheck | null {
    const info = this.lineInfo(index);
    const cost = this.lineCost(index);
    const salePrice = info?.salePrice ?? 0;
    if (!info || salePrice <= 0 || cost <= 0) return null;
    const profit = salePrice - cost;
    const pct = profit / salePrice;
    return { salePrice, profit, pct: Math.round(pct * 100), level: profit <= 0 ? 'loss' : pct < LOW_MARGIN ? 'low' : 'ok' };
  }

  // Sugerencia: mantener el mismo margen que tenía con el costo anterior.
  suggestedPrice(index: number): number {
    const info = this.lineInfo(index);
    const cost = this.lineCost(index);
    const ref = this.reference(index);
    const markup = info?.salePrice && ref?.unitCost ? info.salePrice / ref.unitCost : DEFAULT_MARKUP;
    return Math.ceil(cost * Math.max(markup, 1 + LOW_MARGIN));
  }

  startPriceEdit(index: number) {
    const productId = this.itemsArray.at(index).get('productId')!.value as string;
    this.editingPriceFor.set(productId);
    this.newSalePrice.set(this.suggestedPrice(index));
  }

  onNewSalePriceInput(event: Event) {
    this.newSalePrice.set(Math.max(0, Number((event.target as HTMLInputElement).value) || 0));
  }

  saveSalePrice() {
    const productId = this.editingPriceFor();
    const price = this.newSalePrice();
    if (!productId || price <= 0) return;
    this.savingPrice.set(true);
    this.productsService.updateSalePrice(productId, price).subscribe({
      next: () => {
        this.savingPrice.set(false);
        this.editingPriceFor.set(null);
        this.costInfo.update(map => (map[productId] ? { ...map, [productId]: { ...map[productId], salePrice: price } } : map));
        this.products.update(list => list.map(p => (p.id === productId ? { ...p, salePrice: price } : p)));
      },
      error: (err: HttpErrorResponse) => {
        this.savingPrice.set(false);
        this.errorMessage.set(this.mapError(err));
      },
    });
  }

  productName(index: number): string {
    const id = this.itemsArray.at(index).get('productId')!.value;
    return this.products().find(p => p.id === id)?.name ?? '';
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
      ...(this.isDirectFlow() && this.receiveMode() === 'now' ? { receiveNow: true } : {}),
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
      next: purchase => {
        const paid = id ? 0 : this.paidNow(purchase.total ?? this.total());
        if (paid <= 0) {
          this.saved.emit(purchase);
          return;
        }
        this.purchasePaymentsService
          .create(purchase.id, {
            paymentMethodId: this.payMethodId(), amount: paid, currency: 'BOB',
            notes: null, qrImageUrl: null, proofImageUrl: null, markAsPaid: true,
          })
          .subscribe({
            next: () => this.saved.emit({ ...purchase, paidAmount: paid }),
            // La compra ya existe: no se repite; el pago se registra desde el detalle.
            error: () => this.saved.emit({ ...purchase, paidAmount: 0 }),
          });
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
    return 'Ocurrió un error al guardar la compra.';
  }
}
