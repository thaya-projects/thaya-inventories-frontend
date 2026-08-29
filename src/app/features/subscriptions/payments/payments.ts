import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { paymentStatusBadgeClass } from '../../../shared/payment-status';
import { ToastService } from '../../../shared/toast/toast.service';
import { SubscriptionPaymentsService } from '../../../core/services/subscription-payments';
import { CompanySubscriptionsService } from '../../../core/services/company-subscriptions';
import { SubscriptionPayment } from '../../../core/models/subscription-payment.model';

const STATUS_OPTIONS = ['Pending', 'Paid', 'Failed', 'Refunded'] as const;

@Component({
  selector: 'app-payments',
  imports: [DataTable, DatePipe],
  templateUrl: './payments.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Payments {
  private paymentsService = inject(SubscriptionPaymentsService);
  private subscriptionsService = inject(CompanySubscriptionsService);
  private toast = inject(ToastService);

  statusOptions = STATUS_OPTIONS;
  statusBadgeClass = paymentStatusBadgeClass;

  payments = signal<SubscriptionPayment[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  statusFilter = signal<string>('');
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  markingId = signal<string | null>(null);

  // El pago solo trae companySubscriptionId, no el nombre de la empresa — lo
  // resolvemos con un mapa armado desde /company-subscriptions.
  private subscriptionNames = signal<Record<string, string>>({});

  private companyTpl = viewChild.required<TemplateRef<{ $implicit: SubscriptionPayment }>>('companyTpl');
  private amountTpl = viewChild.required<TemplateRef<{ $implicit: SubscriptionPayment }>>('amountTpl');
  private statusTpl = viewChild.required<TemplateRef<{ $implicit: SubscriptionPayment }>>('statusTpl');
  private dateTpl = viewChild.required<TemplateRef<{ $implicit: SubscriptionPayment }>>('dateTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: SubscriptionPayment }>>('actionsTpl');

  columns = computed<DataTableColumn<SubscriptionPayment>[]>(() => [
    { key: 'companySubscriptionId', label: 'Empresa', cellTemplate: this.companyTpl() },
    { key: 'amount', label: 'Monto', cellTemplate: this.amountTpl() },
    { key: 'paymentMethod', label: 'Método / proveedor' },
    { key: 'status', label: 'Estado', cellTemplate: this.statusTpl() },
    { key: 'createdAt', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    this.loadSubscriptionNames();
    this.load();
  }

  private loadSubscriptionNames() {
    // No bloqueamos la pantalla de pagos si esto falla — a lo sumo se ve el id crudo.
    this.subscriptionsService.list(1, 1000).subscribe({
      next: result => {
        const map: Record<string, string> = {};
        for (const sub of result.items) {
          map[sub.id] = sub.companyName;
        }
        this.subscriptionNames.set(map);
      },
      error: () => {},
    });
  }

  companyNameFor(payment: SubscriptionPayment): string {
    return this.subscriptionNames()[payment.companySubscriptionId] ?? `${payment.companySubscriptionId.slice(0, 8)}…`;
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const status = this.statusFilter();
    this.paymentsService.list(this.page(), this.pageSize(), status ? { status } : undefined).subscribe({
      next: result => {
        this.payments.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(this.mapError(err));
        this.loading.set(false);
      },
    });
  }

  setStatusFilter(status: string) {
    this.statusFilter.set(status);
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

  markPaid(payment: SubscriptionPayment) {
    this.markingId.set(payment.id);
    this.paymentsService.markPaid(payment.id).subscribe({
      next: () => {
        this.markingId.set(null);
        this.toast.success('Pago marcado como pagado.');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.markingId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error. Intenta nuevamente.';
  }
}
