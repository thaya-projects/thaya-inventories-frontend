import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { SalesOrdersService } from '../../../core/services/sales-orders';
import { SalesOrder, SalesOrderStatus } from '../../../core/models/sales-order.model';
import { SalesOrderDetailModal } from '../sales-order-detail-modal/sales-order-detail-modal';
import { SalesTabs } from '../sales-tabs/sales-tabs';
import { CompanyContextService } from '../../../core/services/company-context';
import { saleStatusBadgeClass, saleStatusLabel } from '../sale-status';
import { PAYMENT_TYPE_LABELS, PaymentMethodType } from '../../../core/models/payment-method.model';

type StatusFilter = 'all' | SalesOrderStatus;

const STATUS_VALUES: SalesOrderStatus[] = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];

@Component({
  selector: 'app-sales-orders-list',
  imports: [DataTable, RouterLink, DatePipe, SalesOrderDetailModal, SalesTabs],
  templateUrl: './sales-orders-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrdersList {
  private salesOrdersService = inject(SalesOrdersService);
  private route = inject(ActivatedRoute);

  orders = signal<SalesOrder[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  statusFilter = signal<StatusFilter>('all');

  selectedOrderId = signal<string | null>(null);

  private companyContext = inject(CompanyContextService);
  isFactory = computed(() => this.companyContext.company()?.settings?.usesProduction === true);

  statusLabel = (o: SalesOrder) => saleStatusLabel(o.status, o.freightType, this.isFactory());
  statusBadgeClass = (o: SalesOrder) => saleStatusBadgeClass(o.status, this.isFactory());

  // Solo relevante mientras está Pending — una vez despachada, el stock ya se
  // descontó o el back rechazó el despacho.
  hasInsufficientStock = (order: SalesOrder) =>
    order.status === 'Pending' && order.items.some(i => i.insufficientStock);

  // Cobro de la venta en palabras: "Efectivo", "Efectivo + QR", "Debe Bs 120.00" o "Sin cobrar".
  paymentInfo = (o: SalesOrder): { label: string; detail: string | null; tone: 'paid' | 'partial' | 'none' | 'muted' } => {
    if (o.status === 'Cancelled' || o.total == null) return { label: '—', detail: null, tone: 'muted' };
    const paid = o.paidAmount ?? 0;
    const due = Math.max(0, o.total - paid);
    const methods = (o.paymentMethodTypes ?? [])
      .map(t => PAYMENT_TYPE_LABELS[t as PaymentMethodType] ?? 'Otro')
      .join(' + ');
    if (o.total > 0 && due <= 0.009) return { label: methods || 'Pagada', detail: null, tone: 'paid' };
    if (paid > 0) return { label: `Debe Bs ${due.toFixed(2)}`, detail: methods ? `Pagó ${paid.toFixed(2)} · ${methods}` : null, tone: 'partial' };
    return { label: 'Sin cobrar', detail: null, tone: 'none' };
  };

  private customerTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('customerTpl');
  private paymentTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('paymentTpl');
  private dateTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('dateTpl');
  private totalTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('totalTpl');
  private statusTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('statusTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('actionsTpl');

  columns = computed<DataTableColumn<SalesOrder>[]>(() => [
    { key: 'number', label: '#' },
    { key: 'date', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'customerName', label: 'Cliente', cellTemplate: this.customerTpl() },
    { key: 'total', label: 'Total', cellTemplate: this.totalTpl() },
    { key: 'paidAmount', label: 'Cobro', cellTemplate: this.paymentTpl() },
    { key: 'status', label: 'Estado', cellTemplate: this.statusTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    // Permite llegar con un filtro precargado (ej. desde el Dashboard: ?status=Pending)
    // o con el detalle de una venta puntual ya abierto (?view=<id>).
    const statusParam = this.route.snapshot.queryParamMap.get('status') as SalesOrderStatus | null;
    if (statusParam && STATUS_VALUES.includes(statusParam)) {
      this.statusFilter.set(statusParam);
    }

    const viewId = this.route.snapshot.queryParamMap.get('view');
    if (viewId) {
      this.selectedOrderId.set(viewId);
    }

    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const filter = this.statusFilter();
    const status = filter === 'all' ? undefined : filter;

    this.salesOrdersService.list(this.page(), this.pageSize(), { status }).subscribe({
      next: result => {
        this.orders.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de ventas.');
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
    this.page.set(1);
    this.load();
  }

  onPageChange(page: number) {
    this.page.set(page);
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  openDetail(order: SalesOrder) {
    this.selectedOrderId.set(order.id);
  }

  closeDetail() {
    this.selectedOrderId.set(null);
  }

  onOrderUpdated(updated: SalesOrder) {
    this.orders.update(list => list.map(o => (o.id === updated.id ? updated : o)));
  }
}
