import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { PurchasesService } from '../../../core/services/purchases';
import { Purchase, PurchaseStatus } from '../../../core/models/purchase.model';
import { PurchaseFormModal } from '../purchase-form-modal/purchase-form-modal';
import { PurchaseDetailModal } from '../purchase-detail-modal/purchase-detail-modal';
import { ToastService } from '../../../shared/toast/toast.service';

type StatusFilter = 'all' | PurchaseStatus;
const STATUS_VALUES: PurchaseStatus[] = ['Pending', 'Received', 'Cancelled'];

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  Pending: 'Pendiente',
  Received: 'Recibida',
  Cancelled: 'Cancelada',
};

const STATUS_BADGE_CLASS: Record<PurchaseStatus, string> = {
  Pending: 'bg-gr-warning-bg text-gr-warning',
  Received: 'bg-gr-success-bg text-gr-success',
  Cancelled: 'bg-gr-danger-bg text-gr-danger',
};

@Component({
  selector: 'app-purchases-list',
  imports: [DataTable, DatePipe, PurchaseFormModal, PurchaseDetailModal],
  templateUrl: './purchases-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchasesList {
  private purchasesService = inject(PurchasesService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  purchases = signal<Purchase[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  statusFilter = signal<StatusFilter>('all');

  showCreateModal = signal(false);
  selectedPurchaseId = signal<string | null>(null);

  statusLabel = (status: string) => STATUS_LABELS[status as PurchaseStatus] ?? status;
  statusBadgeClass = (status: string) => STATUS_BADGE_CLASS[status as PurchaseStatus] ?? 'bg-gr-border-lite text-gr-sub';

  private dateTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('dateTpl');
  private totalTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('totalTpl');
  private statusTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('statusTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('actionsTpl');

  columns = computed<DataTableColumn<Purchase>[]>(() => [
    { key: 'number', label: '#' },
    { key: 'date', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'supplierName', label: 'Proveedor' },
    { key: 'total', label: 'Total', cellTemplate: this.totalTpl() },
    { key: 'status', label: 'Estado', cellTemplate: this.statusTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    // Permite llegar con un filtro precargado (ej. desde el Dashboard: ?status=Pending),
    // con el modal de alta ya abierto (?new=true) o con el detalle de una compra
    // puntual ya abierto (ej. desde el Dashboard "Por recibir": ?view=<id>).
    const statusParam = this.route.snapshot.queryParamMap.get('status') as PurchaseStatus | null;
    if (statusParam && STATUS_VALUES.includes(statusParam)) {
      this.statusFilter.set(statusParam);
    }

    if (this.route.snapshot.queryParamMap.get('new') === 'true') {
      this.showCreateModal.set(true);
    }

    const viewId = this.route.snapshot.queryParamMap.get('view');
    if (viewId) {
      this.selectedPurchaseId.set(viewId);
    }

    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const filter = this.statusFilter();
    const status = filter === 'all' ? undefined : filter;

    this.purchasesService.list(this.page(), this.pageSize(), { status }).subscribe({
      next: result => {
        this.purchases.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de compras.');
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

  onPurchaseCreated() {
    this.showCreateModal.set(false);
    this.toast.success('Compra creada.');
    this.page.set(1);
    this.load();
  }

  openDetail(purchase: Purchase) {
    this.selectedPurchaseId.set(purchase.id);
  }

  closeDetail() {
    this.selectedPurchaseId.set(null);
  }

  onPurchaseUpdated(updated: Purchase) {
    this.purchases.update(list => list.map(p => (p.id === updated.id ? updated : p)));
  }
}
