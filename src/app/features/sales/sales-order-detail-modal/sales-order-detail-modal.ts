import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { SalesOrdersService } from '../../../core/services/sales-orders';
import { SalesOrder, SalesOrderStatus } from '../../../core/models/sales-order.model';
import { SalesOrderPaymentsService } from '../../../core/services/sales-order-payments';
import { SalesOrderPayment } from '../../../core/models/sales-order-payment.model';
import { PaymentMethodsService } from '../../../core/services/payment-methods';
import { PaymentMethod } from '../../../core/models/payment-method.model';
import { AuthService } from '../../../core/services/auth';
import { CompanyContextService } from '../../../core/services/company-context';
import { ToastService } from '../../../shared/toast/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';

type SalesOrderConfirmAction = 'dispatch' | 'cancel';

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

const FREIGHT_LABELS: Record<string, string> = {
  None: 'Sin flete',
  Included: 'Incluido en la venta',
  CustomerPays: 'Cliente paga el flete',
  CompanyPays: 'Lo paga la empresa',
};

@Component({
  selector: 'app-sales-order-detail-modal',
  imports: [RouterLink, DatePipe, ReactiveFormsModule, Modal, ConfirmDialog],
  templateUrl: './sales-order-detail-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrderDetailModal implements OnInit {
  private salesOrdersService = inject(SalesOrdersService);
  private salesOrderPaymentsService = inject(SalesOrderPaymentsService);
  private paymentMethodsService = inject(PaymentMethodsService);
  private auth = inject(AuthService);
  private companyContext = inject(CompanyContextService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  orderId = input.required<string>();
  close = output<void>();
  updated = output<SalesOrder>();

  order = signal<SalesOrder | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  working = signal(false);

  payments = signal<SalesOrderPayment[]>([]);
  paymentsLoading = signal(true);
  paymentMethods = signal<PaymentMethod[]>([]);
  paymentModalOpen = signal(false);
  submittingPayment = signal(false);
  paymentErrorMessage = signal<string | null>(null);

  // Despachar/cancelar: Admin, Warehouse — Assistant puede crear/editar Pending pero no esto.
  canDispatchOrCancel = computed(() => this.auth.currentUser()?.role !== 'Assistant');

  // Estricto === true (a diferencia de LotCodeField, que es visible-por-defecto)
  // — acá se trata de mostrar una columna de solo lectura con el lote asignado
  // por FIFO al despachar, no de pedir uno.
  usesLots = computed(() => this.companyContext.company()?.settings.usesLots === true);

  // Solo relevante mientras la venta está Pending.
  hasInsufficientStock = computed(() => {
    const order = this.order();
    return !!order && order.status === 'Pending' && order.items.some(i => i.insufficientStock);
  });

  totalPaid = computed(() => this.payments().reduce((sum, p) => sum + p.amount, 0));
  balanceDue = computed(() => {
    const total = this.order()?.total;
    return total != null ? Math.max(0, total - this.totalPaid()) : null;
  });

  statusLabel = (status: string) => STATUS_LABELS[status as SalesOrderStatus] ?? status;
  statusBadgeClass = (status: string) =>
    STATUS_BADGE_CLASS[status as SalesOrderStatus] ?? 'bg-gr-border-lite text-gr-sub';
  freightLabel = (type: string) => FREIGHT_LABELS[type] ?? type;

  paymentForm = this.fb.group({
    paymentMethodId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    notes: [''],
    markAsPaid: [true],
  });

  ngOnInit(): void {
    this.load();
    this.loadPayments();

    this.paymentMethodsService.list({ isActive: true }).subscribe({
      next: methods => this.paymentMethods.set(methods),
      error: () => { /* no bloquea el detalle — solo no se podrá cobrar */ },
    });
  }

  private load() {
    this.loading.set(true);
    this.salesOrdersService.get(this.orderId()).subscribe({
      next: order => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la venta.');
        this.loading.set(false);
      },
    });
  }

  private loadPayments() {
    this.paymentsLoading.set(true);
    this.salesOrderPaymentsService.list(this.orderId()).subscribe({
      next: payments => {
        this.payments.set(payments);
        this.paymentsLoading.set(false);
      },
      error: () => {
        this.paymentsLoading.set(false);
      },
    });
  }

  openPaymentModal() {
    this.paymentErrorMessage.set(null);
    this.paymentForm.reset({
      paymentMethodId: '',
      amount: this.balanceDue() ?? 0,
      notes: '',
      markAsPaid: true,
    });
    this.paymentModalOpen.set(true);
  }

  closePaymentModal() {
    if (this.submittingPayment()) return;
    this.paymentModalOpen.set(false);
  }

  submitPayment() {
    const order = this.order();
    if (!order) return;

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const value = this.paymentForm.getRawValue();
    this.paymentErrorMessage.set(null);
    this.submittingPayment.set(true);

    const markAsPaid = value.markAsPaid !== false;

    this.salesOrderPaymentsService
      .create(order.id, {
        paymentMethodId: value.paymentMethodId!,
        amount: value.amount!,
        currency: 'BOB',
        notes: value.notes || null,
        qrImageUrl: null,
        proofImageUrl: null,
        markAsPaid,
      })
      .subscribe({
        next: () => {
          this.submittingPayment.set(false);
          this.paymentModalOpen.set(false);
          this.toast.success(markAsPaid ? 'Cobro registrado como pagado.' : 'Cobro registrado. Queda pendiente en Caja.');
          this.loadPayments();
        },
        error: (err: HttpErrorResponse) => {
          this.submittingPayment.set(false);
          this.paymentErrorMessage.set(this.mapError(err));
        },
      });
  }

  confirmAction = signal<SalesOrderConfirmAction | null>(null);

  dispatchConfirmMessage = computed(() => {
    const base = 'Esto saca stock y no se puede deshacer. ¿Confirmas despachar esta venta?';
    return this.hasInsufficientStock()
      ? `Hay líneas sin stock suficiente. Si al confirmar no alcanza, el sistema rechazará el despacho. ${base}`
      : base;
  });

  askDispatch() {
    this.confirmAction.set('dispatch');
  }

  askCancel() {
    this.confirmAction.set('cancel');
  }

  closeConfirm() {
    if (this.working()) return;
    this.confirmAction.set(null);
  }

  runConfirmedAction() {
    const action = this.confirmAction();
    if (action === 'dispatch') this.dispatch();
    if (action === 'cancel') this.cancel();
  }

  private dispatch() {
    const current = this.order();
    if (!current) return;

    this.working.set(true);
    this.salesOrdersService.dispatch(current.id).subscribe({
      next: order => {
        this.order.set(order);
        this.working.set(false);
        this.confirmAction.set(null);
        this.toast.success('Venta despachada — el stock ya se actualizó.');
        this.updated.emit(order);
      },
      error: (err: HttpErrorResponse) => {
        this.working.set(false);
        this.toast.error(this.mapError(err));
      },
    });
  }

  private cancel() {
    const current = this.order();
    if (!current) return;

    this.working.set(true);
    this.salesOrdersService.cancel(current.id).subscribe({
      next: order => {
        this.order.set(order);
        this.working.set(false);
        this.confirmAction.set(null);
        this.toast.success('Venta cancelada.');
        this.updated.emit(order);
      },
      error: (err: HttpErrorResponse) => {
        this.working.set(false);
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
