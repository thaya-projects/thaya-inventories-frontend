import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { WizardStepper } from '../../../shared/wizard-stepper/wizard-stepper';
import { CustomerFormModal } from '../customer-form-modal/customer-form-modal';
import { SalesOrdersService } from '../../../core/services/sales-orders';
import { ProductsService } from '../../../core/services/products';
import { CustomersService } from '../../../core/services/customers';
import { TransportersService } from '../../../core/services/transporters';
import { Product } from '../../../core/models/product.model';
import { Customer } from '../../../core/models/customer.model';
import { Transporter } from '../../../core/models/transporter.model';
import { FreightType, SaveSalesOrderRequest } from '../../../core/models/sales-order.model';
import { ToastService } from '../../../shared/toast/toast.service';

const PRODUCTS_PAGE_SIZE = 200;
const PRODUCT_RESULTS_LIMIT = 20;

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

type WizardStep = 1 | 2 | 3;

@Component({
  selector: 'app-sales-order-form',
  imports: [ReactiveFormsModule, RouterLink, WizardStepper, CustomerFormModal],
  templateUrl: './sales-order-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrderForm {
  private fb = inject(FormBuilder);
  private salesOrdersService = inject(SalesOrdersService);
  private productsService = inject(ProductsService);
  private customersService = inject(CustomersService);
  private transportersService = inject(TransportersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  orderId = this.route.snapshot.paramMap.get('id');
  isEditMode = !!this.orderId;

  stepLabels = ['Cliente', 'Productos', 'Confirmar'];
  freightTypes = FREIGHT_TYPES;

  step = signal<WizardStep>(1);
  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  products = signal<Product[]>([]);
  customers = signal<Customer[]>([]);
  transporters = signal<Transporter[]>([]);

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
    return this.customers().filter(
      c => c.name.toLowerCase().includes(query) || (c.city ?? '').toLowerCase().includes(query),
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
    forkJoin({
      // Solo Finished — lo que se compra (RawMaterial) no se vende directo, se consume en producción.
      products: this.productsService.list(1, PRODUCTS_PAGE_SIZE, { isActive: true, productType: 'Finished' }),
      customers: this.customersService.list({ isActive: true }),
      transporters: this.transportersService.list(true),
    }).subscribe({
      next: ({ products, customers, transporters }) => {
        this.products.set(products.items);
        this.customers.set(customers);
        this.transporters.set(transporters);

        if (this.orderId) {
          this.loadOrder(this.orderId);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar productos/clientes/transportistas.');
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

  openCustomerModal() {
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

  freight(): number {
    if (this.form.controls.freightType.value !== 'Included') return 0;
    return Number(this.form.controls.freightAmount.value) || 0;
  }

  total(): number {
    const discount = Number(this.form.controls.discount.value) || 0;
    return Math.max(0, this.subtotal() - discount + this.freight());
  }

  selectedTransporter = computed(() => this.transporters().find(t => t.id === this.form.controls.transporterId.value) ?? null);

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
      freightType: value.freightType!,
      freightAmount: value.freightAmount ?? 0,
      transporterId: value.transporterId || null,
      notes: value.notes || null,
      items: value.items!.map((item: any) => ({
        // En alta no se manda id — solo en edición (id presente = actualiza, null = línea nueva).
        ...(this.isEditMode ? { id: item.id ?? null } : {}),
        productId: item.productId,
        variantId: null,
        unitOfMeasureId: item.unitOfMeasureId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    };

    const request = this.isEditMode
      ? this.salesOrdersService.update(this.orderId!, payload)
      : this.salesOrdersService.create(payload);

    request.subscribe({
      next: order => {
        this.toast.success(this.isEditMode ? 'Venta actualizada.' : 'Venta creada.');
        this.router.navigate(['/sales'], { queryParams: { view: order.id } });
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
    return 'Ocurrió un error al guardar la venta.';
  }
}
