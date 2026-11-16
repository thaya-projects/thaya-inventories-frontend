import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { SalesOrdersService } from '../../../core/services/sales-orders';
import { SalesOrder } from '../../../core/models/sales-order.model';
import { SalesOrderPaymentsService } from '../../../core/services/sales-order-payments';
import { SalesOrderPayment } from '../../../core/models/sales-order-payment.model';
import { PaymentMethodsService } from '../../../core/services/payment-methods';
import { PaymentMethod, paymentMethodLabel } from '../../../core/models/payment-method.model';
import { AuthService } from '../../../core/services/auth';
import { CompanyContextService } from '../../../core/services/company-context';
import { ToastService } from '../../../shared/toast/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { InfoHint } from '../../../shared/info-hint/info-hint';
import { dispatchActionLabel, saleStatusBadgeClass, saleStatusLabel } from '../sale-status';

type SalesOrderConfirmAction = 'dispatch' | 'cancel';

const FREIGHT_LABELS_FACTORY: Record<string, string> = {
  None: 'Retira en planta',
  Included: 'Flete en la venta',
  CustomerPays: 'Cliente paga el flete',
  CompanyPays: 'Lo paga la empresa',
};

const FREIGHT_LABELS_INVENTORY: Record<string, string> = {
  None: 'Se lo lleva',
  Included: 'Envío',
  CustomerPays: 'Envío (lo paga el cliente)',
  CompanyPays: 'Envío gratis',
};

@Component({
  selector: 'app-sales-order-detail-modal',
  imports: [InfoHint, RouterLink, DatePipe, ReactiveFormsModule, Modal, ConfirmDialog],
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

  // Entregar: Admin y Ventas (Assistant). Cancelar: solo Admin (Almacén ya no ve ventas).
  canDispatch = computed(() => ['Admin', 'Assistant'].includes(this.auth.currentUser()?.role ?? ''));
  canCancel = computed(() => this.auth.currentUser()?.role === 'Admin');

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
  paidPercent = computed(() => {
    const total = this.order()?.total ?? 0;
    return total > 0 ? Math.min(100, Math.round((this.totalPaid() / total) * 100)) : 0;
  });

  // "Efectivo" o "Efectivo + QR" si pagó con varios métodos.
  paymentMethodsSummary = computed(() =>
    [...new Set(this.payments().map(p => {
      const method = this.paymentMethods().find(m => m.id === p.paymentMethodId);
      return method ? this.methodLabel(method) : (p.paymentMethodName ?? 'Pago');
    }))].join(' + '),
  );

  halfDue = computed(() => Math.round(((this.balanceDue() ?? 0) / 2) * 100) / 100);

  // Estado del cobro en palabras: lo que el usuario necesita saber de un vistazo.
  methodLabel = (m: PaymentMethod) => paymentMethodLabel(m, this.paymentMethods());
  payMethodLabel = (methodId: string | null, fallback: string | null) => {
    const m = this.paymentMethods().find(x => x.id === methodId);
    return m ? this.methodLabel(m) : (fallback ?? 'Pago');
  };

  paymentStatus = computed(() => {
    const due = this.balanceDue() ?? 0;
    const paid = this.totalPaid();
    if (due <= 0) return { label: 'Pagada', badge: 'bg-gr-success-bg text-gr-success' };
    if (paid > 0) return { label: 'Pago parcial', badge: 'bg-gr-warning-bg text-gr-warning' };
    return { label: 'Sin cobrar', badge: 'bg-gr-danger-bg text-gr-danger' };
  });

  balanceDue = computed(() => {
    const total = this.order()?.total;
    return total != null ? Math.max(0, total - this.totalPaid()) : null;
  });

  isFactory = computed(() => this.companyContext.company()?.settings?.usesProduction === true);
  statusLabel = (o: SalesOrder) => saleStatusLabel(o.status, o.freightType, this.isFactory());
  statusBadgeClass = (o: SalesOrder) => saleStatusBadgeClass(o.status, this.isFactory());
  // "Despachar" (fábrica) · "Entregar" / "Marcar como enviada" (inventario).
  dispatchLabel = computed(() => {
    const o = this.order();
    return o ? dispatchActionLabel(o.freightType, this.isFactory()) : 'Despachar';
  });
  freightLabel = (type: string) => (this.isFactory() ? FREIGHT_LABELS_FACTORY : FREIGHT_LABELS_INVENTORY)[type] ?? type;

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
          // Avisar a la lista: su columna "Cobro" depende de los pagos.
          this.updated.emit(order);
        },
        error: (err: HttpErrorResponse) => {
          this.submittingPayment.set(false);
          this.paymentErrorMessage.set(this.mapError(err));
        },
      });
  }

  confirmAction = signal<SalesOrderConfirmAction | null>(null);

  dispatchConfirmMessage = computed(() => {
    const o = this.order();
    const base = this.isFactory()
      ? 'Esto saca stock y no se puede deshacer. ¿Confirmas despachar esta venta?'
      : o && o.freightType !== 'None'
        ? 'Los productos salen del inventario y la venta queda como Enviada. ¿Confirmas?'
        : 'Los productos salen del inventario y la venta queda como Vendida. ¿Confirmas que el cliente ya los recibió?';
    return this.hasInsufficientStock()
      ? `Hay productos sin stock suficiente: si no alcanza, el sistema no dejará continuar. ${base}`
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
        this.toast.success(`Venta ${saleStatusLabel(order.status, order.freightType, this.isFactory()).toLowerCase()}. El stock ya se actualizó.`);
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
