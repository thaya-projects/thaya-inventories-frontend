import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { Modal } from '../../../shared/modal/modal';
import { ToastService } from '../../../shared/toast/toast.service';
import { subscriptionStatusBadgeClass } from '../../../shared/subscription-status';
import { CompanySubscriptionsService } from '../../../core/services/company-subscriptions';
import { SubscriptionPaymentsService } from '../../../core/services/subscription-payments';
import { SubscriptionPlansService } from '../../../core/services/subscription-plans';
import { CompanySubscription } from '../../../core/models/company-subscription.model';

const STATUS_OPTIONS = ['Trial', 'Active', 'PastDue', 'Cancelled', 'Expired'] as const;
const PAYMENT_METHODS = ['qr', 'transfer', 'card', 'paypal'] as const;

@Component({
  selector: 'app-active-subscriptions',
  imports: [DataTable, ReactiveFormsModule, Modal],
  templateUrl: './active-subscriptions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveSubscriptions {
  private subscriptionsService = inject(CompanySubscriptionsService);
  private paymentsService = inject(SubscriptionPaymentsService);
  private plansService = inject(SubscriptionPlansService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  statusOptions = STATUS_OPTIONS;
  paymentMethods = PAYMENT_METHODS;
  statusBadgeClass = subscriptionStatusBadgeClass;

  subscriptions = signal<CompanySubscription[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  statusFilter = signal<string>('');
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  updatingId = signal<string | null>(null);

  // Fecha elegida en el input de "extender trial" por fila, antes de confirmar.
  private extendDates = signal<Record<string, string>>({});

  // Modal "Registrar pago"
  payingSub = signal<CompanySubscription | null>(null);
  paymentSubmitting = signal(false);
  paymentError = signal<string | null>(null);

  paymentForm = this.fb.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    currency: ['USD'],
    paymentMethod: [PAYMENT_METHODS[0] as string, Validators.required],
    markAsPaid: [false],
  });

  private statusTpl = viewChild.required<TemplateRef<{ $implicit: CompanySubscription }>>('statusTpl');
  private planTpl = viewChild.required<TemplateRef<{ $implicit: CompanySubscription }>>('planTpl');
  private trialTpl = viewChild.required<TemplateRef<{ $implicit: CompanySubscription }>>('trialTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: CompanySubscription }>>('actionsTpl');

  columns = computed<DataTableColumn<CompanySubscription>[]>(() => [
    { key: 'companyName', label: 'Empresa' },
    { key: 'planName', label: 'Plan', cellTemplate: this.planTpl() },
    { key: 'status', label: 'Estado', cellTemplate: this.statusTpl() },
    { key: 'trialEndsAt', label: 'Vence trial', cellTemplate: this.trialTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const status = this.statusFilter();
    this.subscriptionsService.list(this.page(), this.pageSize(), status ? { status } : undefined).subscribe({
      next: result => {
        this.subscriptions.set(result.items);
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

  extendDateFor(id: string): string {
    return this.extendDates()[id] ?? '';
  }

  onExtendDateChange(id: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.extendDates.update(map => ({ ...map, [id]: value }));
  }

  extendTrial(sub: CompanySubscription) {
    const newDate = this.extendDates()[sub.id];
    if (!newDate) return;

    this.updatingId.set(sub.id);
    this.subscriptionsService.extendTrial(sub.id, newDate).subscribe({
      next: () => {
        this.updatingId.set(null);
        this.toast.success('Trial extendido.');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.updatingId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
  }

  cancelSubscription(sub: CompanySubscription) {
    if (!confirm(`¿Cancelar la suscripción de ${sub.companyName}? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.updatingId.set(sub.id);
    this.subscriptionsService.cancel(sub.id).subscribe({
      next: () => {
        this.updatingId.set(null);
        this.toast.success('Suscripción cancelada.');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.updatingId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
  }

  // --- Registrar pago ---

  openPaymentModal(sub: CompanySubscription) {
    this.payingSub.set(sub);
    this.paymentError.set(null);
    this.paymentForm.reset({ amount: 0, currency: 'USD', paymentMethod: PAYMENT_METHODS[0], markAsPaid: false });

    // Sugerir el monto según el precio del plan para el ciclo de facturación actual.
    this.plansService.get(sub.planId).subscribe({
      next: plan => {
        const suggested =
          sub.billingCycle === 'Monthly'
            ? plan.priceMonthly
            : sub.billingCycle === 'Quarterly'
              ? plan.priceQuarterly
              : plan.priceYearly;
        if (suggested != null) {
          this.paymentForm.patchValue({ amount: suggested });
        }
      },
      error: () => {
        // No bloqueamos el modal si no se pudo sugerir el monto — el usuario lo escribe a mano.
      },
    });
  }

  closePaymentModal() {
    this.payingSub.set(null);
  }

  submitPayment() {
    const sub = this.payingSub();
    if (!sub || this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const value = this.paymentForm.getRawValue();
    this.paymentSubmitting.set(true);
    this.paymentError.set(null);

    this.subscriptionsService
      .registerPayment(sub.id, {
        amount: value.amount!,
        currency: value.currency || undefined,
        paymentMethod: value.paymentMethod || undefined,
      })
      .subscribe({
        next: payment => {
          if (!value.markAsPaid) {
            this.finishPaymentFlow('Pago registrado.');
            return;
          }

          this.paymentsService.markPaid(payment.id).subscribe({
            next: () => this.finishPaymentFlow('Pago registrado y marcado como pagado.'),
            error: () => {
              // El pago sí se creó (quedó Pending); solo falló confirmar el cobro ahora mismo.
              this.finishPaymentFlow('Pago registrado. No se pudo confirmar el cobro — hacelo desde Pagos de suscripciones.');
            },
          });
        },
        error: (err: HttpErrorResponse) => {
          this.paymentSubmitting.set(false);
          this.paymentError.set(this.mapError(err));
        },
      });
  }

  private finishPaymentFlow(message: string) {
    this.paymentSubmitting.set(false);
    this.payingSub.set(null);
    this.toast.success(message);
    this.load();
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error. Intenta nuevamente.';
  }
}
