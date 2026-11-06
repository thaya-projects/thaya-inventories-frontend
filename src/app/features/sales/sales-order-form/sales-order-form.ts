import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';
import { CustomerFormModal } from '../customer-form-modal/customer-form-modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { SalesOrdersService } from '../../../core/services/sales-orders';
import { ProductsService } from '../../../core/services/products';
import { CustomersService } from '../../../core/services/customers';
import { Product } from '../../../core/models/product.model';
import { Customer } from '../../../core/models/customer.model';
import { FreightType, SaveSalesOrderRequest } from '../../../core/models/sales-order.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { CompanyContextService } from '../../../core/services/company-context';
import { TransportersService } from '../../../core/services/transporters';
import { Transporter } from '../../../core/models/transporter.model';
import { PaymentMethodsService } from '../../../core/services/payment-methods';
import { SalesOrderPaymentsService } from '../../../core/services/sales-order-payments';
import { PaymentMethod, paymentMethodLabel } from '../../../core/models/payment-method.model';
import { SalesOrder } from '../../../core/models/sales-order.model';

// Tienda: cómo pagó el cliente al momento de la venta.
type PayMode = 'full' | 'partial' | 'credit';

const PRODUCTS_PAGE_SIZE = 200;
const PRODUCT_RESULTS_LIMIT = 20;

// Solo fábricas (empresas con producción): flete con transportista y quién lo paga.
const FREIGHT_TYPES: { value: FreightType; label: string; hint: string }[] = [
  { value: 'None', label: 'Retira en planta', hint: 'El cliente viene a buscar' },
  { value: 'CustomerPays', label: 'Cliente paga flete', hint: 'Paga directo al transportista' },
  { value: 'Included', label: 'Flete en la venta', hint: 'Se suma al total' },
  { value: 'CompanyPays', label: 'Empresa paga', hint: 'La empresa asume el costo' },
];

interface ItemSeed {
  id?: string | null;
  productId: string;
  unitOfMeasureId: string;
  quantity: number;
  unitPrice: number;
}

// Shape real de itemsArray.getRawValue() — newItemGroup() más abajo define
// exactamente estos controles.
interface ItemFormValue {
  id: string | null;
  productId: string;
  unitOfMeasureId: string;
  quantity: number;
  unitPrice: number;
}

type WizardStep = 1 | 2 | 3;

@Component({
  selector: 'app-sales-order-form',
  imports: [ReactiveFormsModule, RouterLink, CustomerFormModal, ConfirmDialog],
  templateUrl: './sales-order-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrderForm {
  private fb = inject(FormBuilder);
  private salesOrdersService = inject(SalesOrdersService);
  private productsService = inject(ProductsService);
  private customersService = inject(CustomersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private companyContext = inject(CompanyContextService);
  private transportersService = inject(TransportersService);

  // Fábrica = empresa con producción activa: ve flete y transportista.
  // El resto (tiendas, distribuidoras) ve solo "Se lo lleva / Envío".
  isFactory = computed(() => this.companyContext.company()?.settings?.usesProduction === true);
  freightTypes = FREIGHT_TYPES;
  transporters = signal<Transporter[]>([]);
  private transportersRequested = false;

  // Pago al vender (solo inventario, venta nueva): en una tienda se cobra en el momento.
  private paymentMethodsService = inject(PaymentMethodsService);
  private paymentsService = inject(SalesOrderPaymentsService);
  paymentMethods = signal<PaymentMethod[]>([]);
  payMode = signal<PayMode>('full');
  payMethodId = signal<string>('');
  payAmount = signal<number>(0);
  private paymentMethodsRequested = false;

  orderId = this.route.snapshot.paramMap.get('id');
  isEditMode = !!this.orderId;

  stepLabels = ['Cliente', 'Productos', 'Confirmar'];

  step = signal<WizardStep>(1);
  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  products = signal<Product[]>([]);
  customers = signal<Customer[]>([]);

  customerSearch = signal('');
  productSearch = signal('');
  showCustomerModal = signal(false);

  today = new Date().toISOString().slice(0, 10);

  form = this.fb.group({
    date: [this.today, Validators.required],
    customerId: ['', Validators.required],
    discount: [0, [Validators.min(0)]],
    freightType: ['None' as FreightType, Validators.required],
    freightAmount: [0, [Validators.min(0)]],
    transporterId: [''],
    notes: [''],
    items: this.fb.array<FormGroup>([]),
  });

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  selectedCustomer = computed(() => this.customers().find(c => c.id === this.form.controls.customerId.value) ?? null);

  filteredCustomers = computed(() => {
    const query = this.customerSearch().trim().toLowerCase();
    if (!query) return this.customers();
    // NIT/CI y teléfono se comparan sin espacios ni guiones ("7001-2345" encuentra "+591 70012345").
    const compact = query.replace(/[\s.\-+]/g, '');
    const strip = (v: string | null) => (v ?? '').toLowerCase().replace(/[\s.\-+]/g, '');
    return this.customers().filter(
      c =>
        c.name.toLowerCase().includes(query) ||
        (c.city ?? '').toLowerCase().includes(query) ||
        (compact.length >= 3 && (strip(c.taxId).includes(compact) || strip(c.phone).includes(compact))),
    );
  });

  filteredProducts = computed(() => {
    const query = this.productSearch().trim().toLowerCase();
    const all = this.products();
    const matches = query
      ? all.filter(p => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
      : all;
    return matches.slice(0, PRODUCT_RESULTS_LIMIT);
  });

  constructor() {
    effect(() => {
      if (this.isFactory() || this.isEditMode || this.paymentMethodsRequested || !this.companyContext.company()) return;
      this.paymentMethodsRequested = true;
      this.paymentMethodsService.list({ isActive: true }).pipe(catchError(() => of([] as PaymentMethod[]))).subscribe(list => {
        this.paymentMethods.set(list);
        // Efectivo primero si existe: es lo más común en mostrador.
        const cash = list.find(m => m.type === 'Cash') ?? list.find(m => /efectivo/i.test(m.name));
        this.payMethodId.set((cash ?? list[0])?.id ?? '');
      });
    });

    // La empresa se carga en el Shell; cuando se sabe que es fábrica, se piden los transportistas.
    // Si el rol no tiene acceso (Asistente), queda la lista vacía en vez de romper la pantalla.
    effect(() => {
      if (!this.isFactory() || this.transportersRequested) return;
      this.transportersRequested = true;
      this.transportersService.list(true).pipe(catchError(() => of([] as Transporter[]))).subscribe(list => this.transporters.set(list));
    });

    forkJoin({
      // Una venta puede ser de cualquier tipo de producto, no solo terminado.
      products: this.productsService.list(1, PRODUCTS_PAGE_SIZE, { isActive: true }),
      customers: this.customersService.list({ isActive: true }),
    }).subscribe({
      next: ({ products, customers }) => {
        this.products.set(products.items);
        this.customers.set(customers);

        if (this.orderId) {
          this.loadOrder(this.orderId);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar productos y clientes.');
        this.loading.set(false);
      },
    });
  }

  private loadOrder(id: string) {
    this.salesOrdersService.get(id).subscribe({
      next: order => {
        if (order.status !== 'Pending') {
          // Solo se edita una venta Pending — cualquier otro estado va al
          // detalle, que ahora es un modal desde el listado (?view=<id>).
          this.router.navigate(['/sales'], { queryParams: { view: id } });
          return;
        }

        this.form.patchValue({
          date: order.date?.slice(0, 10) ?? this.today,
          customerId: order.customerId,
          discount: order.discount,
          freightType: order.freightType,
          freightAmount: order.freightAmount,
          transporterId: order.transporterId ?? '',
          notes: order.notes ?? '',
        });

        for (const item of order.items) {
          this.addItem({
            id: item.id,
            productId: item.productId,
            unitOfMeasureId: item.unitOfMeasureId ?? '',
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? 0,
          });
        }

        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la venta.');
        this.loading.set(false);
      },
    });
  }

  selectCustomer(customer: Customer) {
    this.form.controls.customerId.setValue(customer.id);
  }

  // Tocar un cliente ya es la decisión: pasa directo a productos, sin botón "Continuar".
  chooseCustomer(customer: Customer) {
    this.selectCustomer(customer);
    this.next();
  }

  newCustomerName = signal('');

  openCustomerModal(prefill = '') {
    this.newCustomerName.set(prefill);
    this.showCustomerModal.set(true);
  }

  closeCustomerModal() {
    this.showCustomerModal.set(false);
  }

  onCustomerCreated(customer: Customer) {
    this.customers.update(list => [customer, ...list]);
    this.selectCustomer(customer);
    this.showCustomerModal.set(false);
    this.toast.success(`Cliente "${customer.name}" creado.`);
    if (this.step() === 1) this.next();
  }

  // Eligió un cliente que ya existía desde el aviso de duplicado: no se crea otro.
  onCustomerPicked(customer: Customer) {
    this.customers.update(list => (list.some(c => c.id === customer.id) ? list : [customer, ...list]));
    this.selectCustomer(customer);
    this.showCustomerModal.set(false);
    this.toast.success(`Cliente "${customer.name}" seleccionado.`);
    if (this.step() === 1) this.next();
  }

  // Paso 1 -> 2.
  next() {
    if (this.form.controls.customerId.invalid || this.form.controls.date.invalid) {
      this.form.controls.customerId.markAsTouched();
      this.form.controls.date.markAsTouched();
      return;
    }
    this.step.set(2);
  }

  // Navegación de pasos: solo se puede volver a uno ya hecho (los siguientes requieren completar el actual).
  goToStep(n: number) {
    if (n < this.step()) this.step.set(n as WizardStep);
  }

  // Lo elegido en cada paso, para mostrarlo en la barra en vez de un número.
  stepSummary(n: number): string {
    if (n === 1) return this.selectedCustomer()?.name ?? 'Cliente';
    if (n === 2) {
      const count = this.itemsArray.length;
      return count === 0 ? 'Productos' : `${count} ${count === 1 ? 'producto' : 'productos'} · Bs ${this.total().toFixed(2)}`;
    }
    return 'Confirmar';
  }

  // Cancelar a mano desde abajo. Si ya hay productos cargados, se confirma para no perder la venta.
  confirmingCancel = signal(false);

  cancelSale() {
    if (this.itemsArray.length > 0) {
      this.confirmingCancel.set(true);
      return;
    }
    this.router.navigate(['/sales']);
  }

  confirmCancelSale() {
    this.confirmingCancel.set(false);
    this.router.navigate(['/sales']);
  }

  back() {
    this.step.update(s => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  // Paso 2 -> 3. La cantidad puede superar el stock actual — la venta se
  // guarda igual como pedido, solo no se podrá despachar hasta que haya
  // stock (el back valida eso al despachar, no acá).
  review() {
    if (this.itemsArray.length === 0) {
      this.errorMessage.set('Agrega al menos un producto a la venta.');
      return;
    }
    this.errorMessage.set(null);
    this.step.set(3);
  }

  private newItemGroup(seed: ItemSeed): FormGroup {
    return this.fb.group({
      id: [seed.id ?? null],
      productId: [seed.productId, Validators.required],
      unitOfMeasureId: [seed.unitOfMeasureId],
      quantity: [seed.quantity, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [seed.unitPrice, [Validators.required, Validators.min(0)]],
    });
  }

  private addItem(seed: ItemSeed) {
    this.itemsArray.push(this.newItemGroup(seed));
  }

  productFor(productId: string): Product | undefined {
    return this.products().find(p => p.id === productId);
  }

  itemIndexFor(productId: string): number {
    return this.itemsArray.controls.findIndex(g => g.get('productId')!.value === productId);
  }

  cartQuantity(productId: string): number {
    const index = this.itemIndexFor(productId);
    return index === -1 ? 0 : Number(this.itemsArray.at(index).get('quantity')!.value) || 0;
  }

  // Stock restante del producto de esa línea después de esta venta — negativo
  // si la cantidad pedida supera lo disponible.
  stockRemaining(index: number): number | null {
    const group = this.itemsArray.at(index);
    const product = this.productFor(group.get('productId')!.value);
    if (!product) return null;
    const quantity = Number(group.get('quantity')!.value) || 0;
    return product.currentStock - quantity;
  }

  exceedsStock(index: number): boolean {
    const remaining = this.stockRemaining(index);
    return remaining != null && remaining < 0;
  }

  hasStockIssue(): boolean {
    return this.itemsArray.controls.some((_, i) => this.exceedsStock(i));
  }

  incrementProduct(product: Product) {
    const index = this.itemIndexFor(product.id);
    if (index === -1) {
      this.addItem({
        productId: product.id,
        unitOfMeasureId: product.unitOfMeasureId ?? '',
        quantity: 1,
        unitPrice: product.salePrice ?? 0,
      });
      return;
    }
    const control = this.itemsArray.at(index).get('quantity')!;
    control.setValue((Number(control.value) || 0) + 1);
  }

  decrementProduct(product: Product) {
    const index = this.itemIndexFor(product.id);
    if (index === -1) return;

    const control = this.itemsArray.at(index).get('quantity')!;
    const next = (Number(control.value) || 0) - 1;
    if (next <= 0) {
      this.itemsArray.removeAt(index);
    } else {
      control.setValue(next);
    }
  }

  removeItem(index: number) {
    this.itemsArray.removeAt(index);
  }

  lineTotal(index: number): number {
    const group = this.itemsArray.at(index);
    const quantity = Number(group.get('quantity')!.value) || 0;
    const unitPrice = Number(group.get('unitPrice')!.value) || 0;
    return quantity * unitPrice;
  }

  subtotal(): number {
    return this.itemsArray.controls.reduce((sum: number, group) => {
      const quantity = Number(group.get('quantity')!.value) || 0;
      const unitPrice = Number(group.get('unitPrice')!.value) || 0;
      return sum + quantity * unitPrice;
    }, 0);
  }

  // Inventario: el cliente se lo lleva (None) o se le envía; el costo de envío, si hay, se suma al total.
  isDelivery(): boolean {
    return this.form.controls.freightType.value !== 'None';
  }

  setDelivery(delivery: boolean) {
    this.form.controls.freightType.setValue(delivery ? 'Included' : 'None');
    if (!delivery) this.form.controls.freightAmount.setValue(0);
  }

  // Lo que se suma al total. Fábrica: solo "Flete en la venta". Inventario: cualquier envío con costo.
  freight(): number {
    const amount = Math.max(0, Number(this.form.controls.freightAmount.value) || 0);
    if (this.isFactory()) return this.form.controls.freightType.value === 'Included' ? amount : 0;
    return this.isDelivery() ? amount : 0;
  }

  freightLabel(): string {
    return this.isFactory() ? 'Flete' : 'Envío';
  }

  // Método y no computed: el valor del formulario no es un signal, un computed quedaría desactualizado.
  selectedTransporter(): Transporter | null {
    return this.transporters().find(t => t.id === this.form.controls.transporterId.value) ?? null;
  }

  // Tienda: "Se lo lleva" con stock suficiente = venta directa, queda Vendida al guardar.
  // Con envío, sin stock o en fábrica, se guarda como pedido y se entrega/despacha después.
  isDirectSale(): boolean {
    return !this.isEditMode && !this.isFactory() && !this.isDelivery() && !this.hasStockIssue();
  }

  // Se muestra el bloque de pago: tienda, venta nueva y con al menos un método de pago configurado.
  showPayment(): boolean {
    return !this.isFactory() && !this.isEditMode && this.paymentMethods().length > 0;
  }

  setPayMode(mode: PayMode) {
    this.payMode.set(mode);
    if (mode === 'partial' && !this.payAmount()) this.payAmount.set(Math.round((this.total() / 2) * 100) / 100);
  }

  onPayAmountInput(event: Event) {
    this.payAmount.set(Math.max(0, Number((event.target as HTMLInputElement).value) || 0));
  }

  // Lo que se registra como cobrado al guardar (0 = queda debiendo todo).
  paidNow(total = this.total()): number {
    if (!this.showPayment() || !this.payMethodId()) return 0;
    if (this.payMode() === 'full') return total;
    if (this.payMode() === 'partial') return Math.min(this.payAmount(), total);
    return 0;
  }

  methodLabel = (m: PaymentMethod) => paymentMethodLabel(m, this.paymentMethods());

  submitLabel(): string {
    if (this.isEditMode) return 'Guardar cambios';
    if (this.isDirectSale()) return 'Confirmar venta';
    if (!this.isFactory() && this.isDelivery() && !this.hasStockIssue()) return 'Guardar · por enviar';
    return 'Guardar pedido';
  }

  private resolveFreight(): { freightType: FreightType; freightAmount: number } {
    const type = this.form.controls.freightType.value ?? 'None';
    if (this.isFactory()) {
      return { freightType: type, freightAmount: type === 'None' ? 0 : Math.max(0, Number(this.form.controls.freightAmount.value) || 0) };
    }
    // Inventario: con costo → se cobra en la venta; sin costo → envío gratis (lo asume la empresa).
    if (!this.isDelivery()) return { freightType: 'None', freightAmount: 0 };
    return { freightType: this.freight() > 0 ? 'Included' : 'CompanyPays', freightAmount: this.freight() };
  }

  total(): number {
    const discount = Number(this.form.controls.discount.value) || 0;
    return Math.max(0, this.subtotal() - discount + this.freight());
  }

  submit() {
    if (this.itemsArray.length === 0) {
      this.errorMessage.set('Agrega al menos un producto a la venta.');
      this.step.set(2);
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.step.set(1);
      return;
    }

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const payload: SaveSalesOrderRequest = {
      date: value.date!,
      warehouseId: null,
      customerId: value.customerId!,
      discount: value.discount ?? 0,
      ...this.resolveFreight(),
      transporterId: value.transporterId || null,
      notes: value.notes || null,
      items: (value.items as unknown as ItemFormValue[]).map(item => ({
        // En alta no se manda id — solo en edición (id presente = actualiza, null = línea nueva).
        ...(this.isEditMode ? { id: item.id ?? null } : {}),
        productId: item.productId,
        variantId: null,
        unitOfMeasureId: item.unitOfMeasureId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      ...(this.isDirectSale() ? { dispatchNow: true } : {}),
    };

    const request = this.isEditMode
      ? this.salesOrdersService.update(this.orderId!, payload)
      : this.salesOrdersService.create(payload);

    request.subscribe({
      next: order => {
        const paid = this.isEditMode ? 0 : this.paidNow(order.total ?? this.total());
        if (paid > 0) {
          this.paymentsService
            .create(order.id, {
              paymentMethodId: this.payMethodId(),
              amount: paid,
              currency: 'BOB',
              notes: null,
              qrImageUrl: null,
              proofImageUrl: null,
              markAsPaid: true,
            })
            .subscribe({
              next: () => this.finishSave(order, paid),
              // La venta ya existe: no se repite, solo se avisa que falta registrar el pago.
              error: () => {
                this.toast.error('La venta se guardó, pero no se pudo registrar el pago. Regístralo desde el detalle.');
                this.router.navigate(['/sales'], { queryParams: { view: order.id } });
              },
            });
          return;
        }
        this.finishSave(order, 0);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
      },
    });
  }

  private finishSave(order: SalesOrder, paid: number) {
    const total = order.total ?? 0;
    const debt = Math.max(0, total - paid);
    let message: string;
    if (this.isEditMode) message = 'Venta actualizada.';
    else if (this.isFactory()) message = 'Pedido guardado.';
    else {
      const what = order.status === 'Dispatched' ? 'Venta registrada' : order.freightType !== 'None' ? 'Venta guardada, por enviar' : 'Pedido guardado';
      message = !this.showPayment() ? `${what}.` : debt <= 0 ? `${what} y pagada.` : `${what}. Queda debiendo Bs ${debt.toFixed(2)}.`;
    }
    this.toast.success(message);
    this.router.navigate(['/sales'], { queryParams: { view: order.id } });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al guardar la venta.';
  }
}
