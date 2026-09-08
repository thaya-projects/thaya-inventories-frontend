import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { SalesOrdersService } from '../../../core/services/sales-orders';
import { SalesOrder, SalesOrderStatus } from '../../../core/models/sales-order.model';
import { SalesOrderFormModal } from '../sales-order-form-modal/sales-order-form-modal';
import { ToastService } from '../../../shared/toast/toast.service';

type StatusFilter = 'all' | SalesOrderStatus;

const STATUS_LABELS: Record<SalesOrderStatus, string> = {
  Pending: 'Pendiente',
  Dispatched: 'Despachada',
  Delivered: 'Entregada',
  Cancelled: 'Cancelada',
};

const STATUS_BADGE_CLASS: Record<SalesOrderStatus, string> = {
  Pending: 'bg-gr-warning-bg text-gr-warning',
  Dispatched: 'bg-gr-info-bg text-gr-info',
  Delivered: 'bg-gr-success-bg text-gr-success',
  Cancelled: 'bg-gr-danger-bg text-gr-danger',
};

const STATUS_VALUES: SalesOrderStatus[] = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];

@Component({
  selector: 'app-sales-orders-list',
  imports: [DataTable, RouterLink, DatePipe, SalesOrderFormModal],
  templateUrl: './sales-orders-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrdersList {
  private salesOrdersService = inject(SalesOrdersService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  orders = signal<SalesOrder[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  statusFilter = signal<StatusFilter>('all');

  showCreateModal = signal(false);

  statusLabel = (status: string) => STATUS_LABELS[status as SalesOrderStatus] ?? status;
  statusBadgeClass = (status: string) =>
    STATUS_BADGE_CLASS[status as SalesOrderStatus] ?? 'bg-gr-border-lite text-gr-sub';

  private dateTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('dateTpl');
  private totalTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('totalTpl');
  private statusTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('statusTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: SalesOrder }>>('actionsTpl');

  columns = computed<DataTableColumn<SalesOrder>[]>(() => [
    { key: 'number', label: '#' },
    { key: 'date', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'customerName', label: 'Cliente' },
    { key: 'total', label: 'Total', cellTemplate: this.totalTpl() },
    { key: 'status', label: 'Estado', cellTemplate: this.statusTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    // Permite llegar con un filtro precargado (ej. desde el Dashboard: ?status=Pending)
    // o con el modal de alta ya abierto (ej. desde el Dashboard: ?new=true).
    const statusParam = this.route.snapshot.queryParamMap.get('status') as SalesOrderStatus | null;
    if (statusParam && STATUS_VALUES.includes(statusParam)) {
      this.statusFilter.set(statusParam);
    }

    if (this.route.snapshot.queryParamMap.get('new') === 'true') {
      this.showCreateModal.set(true);
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

  openCreateModal() {
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  onOrderCreated() {
    this.showCreateModal.set(false);
    this.toast.success('Venta creada.');
    this.page.set(1);
    this.load();
  }
}
