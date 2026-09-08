import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { PaymentsService } from '../../../core/services/payments';
import { Payment, PaymentSourceType, PaymentSourceTypeValue, PaymentStatus } from '../../../core/models/payment.model';
import { AuthService } from '../../../core/services/auth';

type StatusFilter = 'all' | PaymentStatus;
type SourceFilter = 'all' | PaymentSourceTypeValue;
const STATUS_VALUES: PaymentStatus[] = ['Pending', 'Paid', 'Failed', 'Refunded', 'Cancelled'];
const SOURCE_VALUES: PaymentSourceTypeValue[] = Object.values(PaymentSourceType);

const STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: 'Pendiente',
  Paid: 'Pagado',
  Failed: 'Fallido',
  Refunded: 'Reembolsado',
  Cancelled: 'Cancelado',
};

const STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  Pending: 'bg-gr-warning-bg text-gr-warning',
  Paid: 'bg-gr-success-bg text-gr-success',
  Failed: 'bg-gr-danger-bg text-gr-danger',
  Refunded: 'bg-gr-info-bg text-gr-info',
  Cancelled: 'bg-gr-border-lite text-gr-sub',
};

const SOURCE_LABELS: Record<string, string> = {
  [PaymentSourceType.SalesOrder]: 'Venta',
  [PaymentSourceType.Purchase]: 'Compra',
  [PaymentSourceType.Expense]: 'Gasto',
};

@Component({
  selector: 'app-payments-list',
  imports: [DataTable, RouterLink, DatePipe],
  templateUrl: './payments-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsList {
  private paymentsService = inject(PaymentsService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  paymentSourceType = PaymentSourceType;

  // Assistant: el API ignora el filtro de sourceType y solo devuelve pagos de
  // venta — el filtro de origen no tiene sentido para ese rol, se oculta.
  isAssistant = computed(() => this.auth.currentUser()?.role === 'Assistant');

  payments = signal<Payment[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  statusFilter = signal<StatusFilter>('all');
  sourceFilter = signal<SourceFilter>('all');

  statusLabel = (status: string) => STATUS_LABELS[status as PaymentStatus] ?? status;
  statusBadgeClass = (status: string) =>
    STATUS_BADGE_CLASS[status as PaymentStatus] ?? 'bg-gr-border-lite text-gr-sub';
  sourceLabel = (type: string) => SOURCE_LABELS[type] ?? type;

  private dateTpl = viewChild.required<TemplateRef<{ $implicit: Payment }>>('dateTpl');
  private sourceTpl = viewChild.required<TemplateRef<{ $implicit: Payment }>>('sourceTpl');
  private amountTpl = viewChild.required<TemplateRef<{ $implicit: Payment }>>('amountTpl');
  private statusTpl = viewChild.required<TemplateRef<{ $implicit: Payment }>>('statusTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Payment }>>('actionsTpl');

  columns = computed<DataTableColumn<Payment>[]>(() => [
    { key: 'createdAt', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'sourceLabel', label: 'Origen', cellTemplate: this.sourceTpl() },
    { key: 'amount', label: 'Monto', cellTemplate: this.amountTpl() },
    { key: 'paymentMethodName', label: 'Método' },
    { key: 'status', label: 'Estado', cellTemplate: this.statusTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    const statusParam = this.route.snapshot.queryParamMap.get('status') as PaymentStatus | null;
    if (statusParam && STATUS_VALUES.includes(statusParam)) {
      this.statusFilter.set(statusParam);
    }

    const sourceParam = this.route.snapshot.queryParamMap.get('sourceType') as PaymentSourceTypeValue | null;
    if (sourceParam && SOURCE_VALUES.includes(sourceParam)) {
      this.sourceFilter.set(sourceParam);
    }

    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const statusFilter = this.statusFilter();
    const status = statusFilter === 'all' ? undefined : statusFilter;
    const sourceFilter = this.sourceFilter();
    const sourceType = sourceFilter === 'all' ? undefined : sourceFilter;

    this.paymentsService.list(this.page(), this.pageSize(), { status, sourceType }).subscribe({
      next: result => {
        this.payments.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de pagos.');
        this.loading.set(false);
      },
    });
  }

  setStatusFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
    this.page.set(1);
    this.load();
  }

  setSourceFilter(filter: SourceFilter) {
    this.sourceFilter.set(filter);
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
}
