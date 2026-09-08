import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PurchasesService } from '../../../core/services/purchases';
import { Purchase, PurchaseStatus } from '../../../core/models/purchase.model';
import { PurchasePaymentsService } from '../../../core/services/purchase-payments';
import { PurchasePayment } from '../../../core/models/purchase-payment.model';
import { PaymentMethodsService } from '../../../core/services/payment-methods';
import { PaymentMethod } from '../../../core/models/payment-method.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { PurchaseFormModal } from '../purchase-form-modal/purchase-form-modal';

type PurchaseConfirmAction = 'receive' | 'cancel';

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
  selector: 'app-purchase-detail',
  imports: [RouterLink, DatePipe, ReactiveFormsModule, Modal, ConfirmDialog, PurchaseFormModal],
  templateUrl: './purchase-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseDetail {
  private route = inject(ActivatedRoute);
  private purchasesService = inject(PurchasesService);
  private purchasePaymentsService = inject(PurchasePaymentsService);
  private paymentMethodsService = inject(PaymentMethodsService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  purchase = signal<Purchase | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  working = signal(false);
  editModalOpen = signal(false);

  payments = signal<PurchasePayment[]>([]);
  paymentsLoading = signal(true);
  paymentMethods = signal<PaymentMethod[]>([]);
  paymentModalOpen = signal(false);
  submittingPayment = signal(false);
  paymentErrorMessage = signal<string | null>(null);

  totalPaid = computed(() => this.payments().reduce((sum, p) => sum + p.amount, 0));
  balanceDue = computed(() => {
    const total = this.purchase()?.total;
    return total != null ? Math.max(0, total - this.totalPaid()) : null;
  });

  statusLabel = (status: string) => STATUS_LABELS[status as PurchaseStatus] ?? status;
  statusBadgeClass = (status: string) => STATUS_BADGE_CLASS[status as PurchaseStatus] ?? 'bg-gr-border-lite text-gr-sub';

  paymentForm = this.fb.group({
    paymentMethodId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    notes: [''],
  });

  purchaseId = this.route.snapshot.paramMap.get('id')!;

  constructor() {
    this.load(this.purchaseId);
    this.loadPayments(this.purchaseId);

    this.paymentMethodsService.list({ isActive: true }).subscribe({
      next: methods => this.paymentMethods.set(methods),
      error: () => { /* no bloquea el detalle — solo no se podrá cobrar */ },
    });
  }

  private load(id: string) {
    this.loading.set(true);
    this.purchasesService.get(id).subscribe({
      next: purchase => {
        this.purchase.set(purchase);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la compra.');
        this.loading.set(false);
      },
    });
  }

  private loadPayments(id: string) {
    this.paymentsLoading.set(true);
    this.purchasePaymentsService.list(id).subscribe({
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
    });
    this.paymentModalOpen.set(true);
  }

  closePaymentModal() {
    if (this.submittingPayment()) return;
    this.paymentModalOpen.set(false);
  }

  submitPayment() {
    const purchase = this.purchase();
    if (!purchase) return;

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const value = this.paymentForm.getRawValue();
    this.paymentErrorMessage.set(null);
    this.submittingPayment.set(true);

    this.purchasePaymentsService
      .create(purchase.id, {
        paymentMethodId: value.paymentMethodId!,
        amount: value.amount!,
        currency: 'BOB',
        notes: value.notes || null,
        qrImageUrl: null,
        proofImageUrl: null,
      })
      .subscribe({
        next: () => {
          this.submittingPayment.set(false);
          this.paymentModalOpen.set(false);
          this.toast.success('Pago registrado.');
          this.loadPayments(purchase.id);
        },
        error: (err: HttpErrorResponse) => {
          this.submittingPayment.set(false);
          this.paymentErrorMessage.set(this.mapError(err));
        },
      });
  }

  openEditModal() {
    this.editModalOpen.set(true);
  }

  closeEditModal() {
    this.editModalOpen.set(false);
  }

  onPurchaseUpdated(purchase: Purchase) {
    this.purchase.set(purchase);
    this.editModalOpen.set(false);
    this.toast.success('Compra actualizada.');
  }

  confirmAction = signal<PurchaseConfirmAction | null>(null);

  askReceive() {
    this.confirmAction.set('receive');
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
    if (action === 'receive') this.receive();
    if (action === 'cancel') this.cancel();
  }

  private receive() {
    const current = this.purchase();
    if (!current) return;

    this.working.set(true);
    this.purchasesService.receive(current.id).subscribe({
      next: purchase => {
        this.purchase.set(purchase);
        this.working.set(false);
        this.confirmAction.set(null);
        this.toast.success('Compra recibida — el stock ya se actualizó.');
      },
      error: (err: HttpErrorResponse) => {
        this.working.set(false);
        this.toast.error(this.mapError(err));
      },
    });
  }

  private cancel() {
    const current = this.purchase();
    if (!current) return;

    this.working.set(true);
    this.purchasesService.cancel(current.id).subscribe({
      next: purchase => {
        this.purchase.set(purchase);
        this.working.set(false);
        this.confirmAction.set(null);
        this.toast.success('Compra cancelada.');
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
