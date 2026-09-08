import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { PaymentsService } from '../../../core/services/payments';
import { Payment, PaymentSourceType, PaymentStatus } from '../../../core/models/payment.model';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '../../../core/models/product-image.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';

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
  selector: 'app-payment-detail',
  imports: [RouterLink, DatePipe, ConfirmDialog],
  templateUrl: './payment-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDetail {
  private route = inject(ActivatedRoute);
  private paymentsService = inject(PaymentsService);
  private toast = inject(ToastService);

  payment = signal<Payment | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  working = signal(false);
  uploadingProof = signal(false);
  uploadError = signal<string | null>(null);

  statusLabel = (status: string) => STATUS_LABELS[status as PaymentStatus] ?? status;
  statusBadgeClass = (status: string) =>
    STATUS_BADGE_CLASS[status as PaymentStatus] ?? 'bg-gr-border-lite text-gr-sub';
  sourceLabel = (type: string) => SOURCE_LABELS[type] ?? type;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  private load(id: string) {
    this.loading.set(true);
    this.paymentsService.get(id).subscribe({
      next: payment => {
        this.payment.set(payment);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el pago.');
        this.loading.set(false);
      },
    });
  }

  onFileSelected(event: Event) {
    const current = this.payment();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file || !current) {
      input.value = '';
      return;
    }

    this.uploadError.set(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      this.uploadError.set('Solo se permiten imágenes JPEG, PNG o WEBP.');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      this.uploadError.set('El archivo supera el tamaño máximo permitido de 5 MB.');
      input.value = '';
      return;
    }

    this.uploadingProof.set(true);
    this.paymentsService.uploadProof(current.id, file).subscribe({
      next: payment => {
        this.payment.set(payment);
        this.uploadingProof.set(false);
        this.toast.success('Comprobante subido.');
        input.value = '';
      },
      error: (err: HttpErrorResponse) => {
        this.uploadingProof.set(false);
        this.uploadError.set(this.mapError(err));
        input.value = '';
      },
    });
  }

  markPaid() {
    const current = this.payment();
    if (!current) return;

    this.working.set(true);
    this.paymentsService
      .markPaid(current.id, {
        paidAt: new Date().toISOString(),
        proofImageUrl: current.proofImageUrl,
        notes: current.notes,
      })
      .subscribe({
        next: payment => {
          this.payment.set(payment);
          this.working.set(false);
          this.toast.success('Pago marcado como pagado.');
        },
        error: (err: HttpErrorResponse) => {
          this.working.set(false);
          this.toast.error(this.mapError(err));
        },
      });
  }

  confirmCancelOpen = signal(false);

  askCancel() {
    this.confirmCancelOpen.set(true);
  }

  closeCancelConfirm() {
    if (this.working()) return;
    this.confirmCancelOpen.set(false);
  }

  confirmCancel() {
    const current = this.payment();
    if (!current) return;

    this.working.set(true);
    this.paymentsService.cancel(current.id).subscribe({
      next: payment => {
        this.payment.set(payment);
        this.working.set(false);
        this.confirmCancelOpen.set(false);
        this.toast.success('Pago cancelado.');
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
