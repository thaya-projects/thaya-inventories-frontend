import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { ProductionOrdersService } from '../../../core/services/production-orders';
import { ProductionOrder, ProductionOrderStatus } from '../../../core/models/production-order.model';
import { ProductionOrderRegisterModal } from '../production-order-register-modal/production-order-register-modal';
import { ProductionOrderDetailModal } from '../production-order-detail-modal/production-order-detail-modal';
import { ToastService } from '../../../shared/toast/toast.service';

type StatusFilter = 'all' | ProductionOrderStatus;
const STATUS_VALUES: ProductionOrderStatus[] = ['Planned', 'InProgress', 'Completed', 'Cancelled'];

const STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  Planned: 'Planificada',
  InProgress: 'En proceso',
  Completed: 'Completada',
  Cancelled: 'Cancelada',
};

const STATUS_BADGE_CLASS: Record<ProductionOrderStatus, string> = {
  Planned: 'bg-gr-warning-bg text-gr-warning',
  InProgress: 'bg-gr-info-bg text-gr-info',
  Completed: 'bg-gr-success-bg text-gr-success',
  Cancelled: 'bg-gr-danger-bg text-gr-danger',
};

@Component({
  selector: 'app-production-orders-list',
  imports: [DataTable, DatePipe, ProductionOrderRegisterModal, ProductionOrderDetailModal],
  templateUrl: './production-orders-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionOrdersList {
  private productionOrdersService = inject(ProductionOrdersService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  orders = signal<ProductionOrder[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  statusFilter = signal<StatusFilter>('all');

  showCreateModal = signal(false);
  selectedOrderId = signal<string | null>(null);

  statusLabel = (status: string) => STATUS_LABELS[status as ProductionOrderStatus] ?? status;
  statusBadgeClass = (status: string) =>
    STATUS_BADGE_CLASS[status as ProductionOrderStatus] ?? 'bg-gr-border-lite text-gr-sub';

  // Solo relevante mientras la orden sigue abierta — una vez Completed/Cancelled
  // ya no aplica (se completó igual o se descartó).
  hasInsufficientStock = (order: ProductionOrder) =>
    (order.status === 'Planned' || order.status === 'InProgress') &&
    order.consumptions.some(c => c.insufficientStock);

  private dateTpl = viewChild.required<TemplateRef<{ $implicit: ProductionOrder }>>('dateTpl');
  private statusTpl = viewChild.required<TemplateRef<{ $implicit: ProductionOrder }>>('statusTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: ProductionOrder }>>('actionsTpl');

  columns = computed<DataTableColumn<ProductionOrder>[]>(() => [
    { key: 'lotCode', label: 'Lote' },
    { key: 'date', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'productName', label: 'Producto' },
    { key: 'quantityProduced', label: 'Cantidad' },
    { key: 'status', label: 'Estado', cellTemplate: this.statusTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    // Permite llegar con el modal de alta ya abierto (?new=true) o con el
    // detalle de una orden puntual ya abierto (?view=<id>).
    if (this.route.snapshot.queryParamMap.get('new') === 'true') {
      this.showCreateModal.set(true);
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

    this.productionOrdersService.list(this.page(), this.pageSize(), { status }).subscribe({
      next: result => {
        this.orders.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(this.mapError(err));
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

  onOrderCreated(order: ProductionOrder) {
    this.showCreateModal.set(false);
    this.toast.success(order.status === 'Completed' ? 'Producción registrada — stock actualizado.' : 'Orden de producción creada.');
    this.page.set(1);
    this.load();
  }

  openDetail(order: ProductionOrder) {
    this.selectedOrderId.set(order.id);
  }

  closeDetail() {
    this.selectedOrderId.set(null);
  }

  onOrderUpdated(updated: ProductionOrder) {
    this.orders.update(list => list.map(o => (o.id === updated.id ? updated : o)));
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'No se pudo cargar el listado de producción.';
  }
}
