import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { PurchasesService } from '../../../core/services/purchases';
import { Purchase, PurchaseStatus } from '../../../core/models/purchase.model';
import { PurchaseFormModal } from '../purchase-form-modal/purchase-form-modal';
import { PurchaseDetailModal } from '../purchase-detail-modal/purchase-detail-modal';
import { ToastService } from '../../../shared/toast/toast.service';
import { PurchasesTabs } from '../purchases-tabs/purchases-tabs';
import { PAYMENT_TYPE_LABELS, PaymentMethodType } from '../../../core/models/payment-method.model';

type StatusFilter = 'all' | PurchaseStatus;
type ViewMode = 'list' | 'supplier';

// Vista por proveedor: se agrupan las compras de cada proveedor (no se fusionan: cada compra
// sigue siendo un documento con su fecha, productos y pagos).
const GROUPED_PAGE_SIZE = 500;
const VIEW_KEY = 'thaya.purchases.view';

export interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  purchases: Purchase[];
  total: number;
  pendingCount: number;
  lastDate: string;
}
const STATUS_VALUES: PurchaseStatus[] = ['Pending', 'Received', 'Cancelled'];

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  Pending: 'Por recibir',
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
  imports: [DataTable, DatePipe, PurchaseFormModal, PurchaseDetailModal, PurchasesTabs],
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

  viewMode = signal<ViewMode>(readViewMode());
  expanded = signal<Set<string>>(new Set());

  // Total sin contar canceladas; "pendientes" = por recibir.
  groups = computed<SupplierGroup[]>(() => {
    const map = new Map<string, SupplierGroup>();
    for (const p of this.purchases()) {
      const key = p.supplierId ?? 'none';
      const g = map.get(key) ?? { supplierId: key, supplierName: p.supplierName ?? 'Sin proveedor', purchases: [], total: 0, pendingCount: 0, lastDate: p.date };
      g.purchases.push(p);
      if (p.status !== 'Cancelled') g.total += p.total ?? 0;
      if (p.status === 'Pending') g.pendingCount++;
      if (p.date > g.lastDate) g.lastDate = p.date;
      map.set(key, g);
    }
    return [...map.values()]
      .map(g => ({ ...g, purchases: [...g.purchases].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number) }))
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  });

  setViewMode(mode: ViewMode) {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    try { localStorage.setItem(VIEW_KEY, mode); } catch { /* sin almacenamiento: solo no se recuerda */ }
    this.page.set(1);
    this.load();
  }

  toggleGroup(id: string) {
    this.expanded.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isExpanded = (id: string) => this.expanded().has(id);

  showCreateModal = signal(false);
  selectedPurchaseId = signal<string | null>(null);

  statusLabel = (status: string) => STATUS_LABELS[status as PurchaseStatus] ?? status;
  statusBadgeClass = (status: string) => STATUS_BADGE_CLASS[status as PurchaseStatus] ?? 'bg-gr-border-lite text-gr-sub';

  // Productos como etiquetas: se muestran los primeros y "+N más".
  readonly visibleLines = 3;

  qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

  // Pago al proveedor en palabras: "Efectivo", "Debe Bs 120.00", "Sin pagar".
  paymentInfo = (p: Purchase): { label: string; detail: string | null; tone: 'paid' | 'partial' | 'none' | 'muted' } => {
    if (p.status === 'Cancelled' || p.total == null) return { label: '—', detail: null, tone: 'muted' };
    const paid = p.paidAmount ?? 0;
    const due = Math.max(0, p.total - paid);
    const methods = (p.paymentMethodTypes ?? []).map(t => PAYMENT_TYPE_LABELS[t as PaymentMethodType] ?? 'Otro').join(' + ');
    if (p.total > 0 && due <= 0.009) return { label: methods || 'Pagada', detail: null, tone: 'paid' };
    if (paid > 0) return { label: `Debes Bs ${due.toFixed(2)}`, detail: `Pagaste ${paid.toFixed(2)}${methods ? ' · ' + methods : ''}`, tone: 'partial' };
    return { label: 'Sin pagar', detail: null, tone: 'none' };
  };

  private supplierTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('supplierTpl');
  private paymentTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('paymentTpl');
  private dateTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('dateTpl');
  private totalTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('totalTpl');
  private statusTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('statusTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Purchase }>>('actionsTpl');

  columns = computed<DataTableColumn<Purchase>[]>(() => [
    { key: 'number', label: '#' },
    { key: 'date', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'supplierName', label: 'Proveedor y productos', cellTemplate: this.supplierTpl() },
    { key: 'total', label: 'Total', cellTemplate: this.totalTpl() },
    { key: 'paidAmount', label: 'Pago', cellTemplate: this.paymentTpl() },
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

    const grouped = this.viewMode() === 'supplier';
    const page = grouped ? 1 : this.page();
    const size = grouped ? GROUPED_PAGE_SIZE : this.pageSize();

    this.purchasesService.list(page, size, { status }).subscribe({
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

  onPurchaseCreated(purchase?: Purchase) {
    this.showCreateModal.set(false);
    const total = purchase?.total ?? 0;
    const debt = Math.max(0, total - (purchase?.paidAmount ?? 0));
    const base = purchase?.status === 'Received' ? 'Compra registrada. El stock ya subió' : 'Compra guardada. Queda por recibir';
    this.toast.success(debt > 0.009 && purchase?.paidAmount != null ? `${base}. Debes Bs ${debt.toFixed(2)}.` : `${base}.`);
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

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'supplier' ? 'supplier' : 'list';
  } catch {
    return 'list';
  }
}
