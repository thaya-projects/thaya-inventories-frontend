import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ExpensesService } from '../../../core/services/expenses';
import { ExpensePaymentsService } from '../../../core/services/expense-payments';
import { PaymentsService } from '../../../core/services/payments';
import { PaymentMethodsService } from '../../../core/services/payment-methods';
import { Expense, ExpenseCategory, ExpensePaymentStatus } from '../../../core/models/expense.model';
import { Payment } from '../../../core/models/payment.model';
import { PaymentMethod } from '../../../core/models/payment-method.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { ExpenseFormModal } from '../expense-form-modal/expense-form-modal';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  Transport: 'Transporte',
  Utilities: 'Servicios básicos',
  Labor: 'Mano de obra',
  Maintenance: 'Mantenimiento',
  RawMaterial: 'Materia prima',
  Administrative: 'Administrativo',
  Taxes: 'Impuestos',
  Other: 'Otros',
};

const PAYMENT_STATUS_LABELS: Record<ExpensePaymentStatus, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagado',
};

const PAYMENT_STATUS_BADGE_CLASS: Record<ExpensePaymentStatus, string> = {
  pending: 'bg-gr-warning-bg text-gr-warning',
  partial: 'bg-gr-info-bg text-gr-info',
  paid: 'bg-gr-success-bg text-gr-success',
};

const PAYMENTS_PAGE_SIZE = 100;

@Component({
  selector: 'app-expense-detail',
  imports: [RouterLink, DatePipe, ReactiveFormsModule, Modal, ExpenseFormModal],
  templateUrl: './expense-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseDetail {
  private route = inject(ActivatedRoute);
  private expensesService = inject(ExpensesService);
  private expensePaymentsService = inject(ExpensePaymentsService);
  private paymentsService = inject(PaymentsService);
  private paymentMethodsService = inject(PaymentMethodsService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  expense = signal<Expense | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  editModalOpen = signal(false);

  payments = signal<Payment[]>([]);
  paymentsLoading = signal(true);
  paymentMethods = signal<PaymentMethod[]>([]);
  paymentModalOpen = signal(false);
  submittingPayment = signal(false);
  paymentErrorMessage = signal<string | null>(null);

  categoryLabel = (category: string) => CATEGORY_LABELS[category as ExpenseCategory] ?? category;
  statusLabel = (status: string) => PAYMENT_STATUS_LABELS[status as ExpensePaymentStatus] ?? status;
  statusBadgeClass = (status: string) =>
    PAYMENT_STATUS_BADGE_CLASS[status as ExpensePaymentStatus] ?? 'bg-gr-border-lite text-gr-sub';

  balanceDue = computed(() => this.expense()?.pendingAmount ?? 0);

  paymentForm = this.fb.group({
    paymentMethodId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    notes: [''],
  });

  expenseId = this.route.snapshot.paramMap.get('id')!;

  constructor() {
    this.load(this.expenseId);
    this.loadPayments(this.expenseId);

    this.paymentMethodsService.list({ isActive: true }).subscribe({
      next: methods => this.paymentMethods.set(methods),
      error: () => { /* no bloquea el detalle — solo no se podrá cobrar */ },
    });
  }

  private load(id: string) {
    this.loading.set(true);
    this.expensesService.get(id).subscribe({
      next: expense => {
        this.expense.set(expense);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el gasto.');
        this.loading.set(false);
      },
    });
  }

  // No hay GET /api/expenses/{id}/payments — se usa el endpoint genérico de
  // Caja filtrado por sourceId.
  private loadPayments(id: string) {
    this.paymentsLoading.set(true);
    this.paymentsService.list(1, PAYMENTS_PAGE_SIZE, { sourceId: id }).subscribe({
      next: result => {
        this.payments.set(result.items);
        this.paymentsLoading.set(false);
      },
      error: () => {
        this.paymentsLoading.set(false);
      },
    });
  }

  openEditModal() {
    this.editModalOpen.set(true);
  }

  closeEditModal() {
    this.editModalOpen.set(false);
  }

  onExpenseUpdated(expense: Expense) {
    this.expense.set(expense);
    this.editModalOpen.set(false);
    this.toast.success('Gasto actualizado.');
  }

  openPaymentModal() {
    this.paymentErrorMessage.set(null);
    this.paymentForm.reset({
      paymentMethodId: '',
      amount: this.balanceDue(),
      notes: '',
    });
    this.paymentModalOpen.set(true);
  }

  closePaymentModal() {
    if (this.submittingPayment()) return;
    this.paymentModalOpen.set(false);
  }

  submitPayment() {
    const expense = this.expense();
    if (!expense) return;

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const value = this.paymentForm.getRawValue();
    this.paymentErrorMessage.set(null);
    this.submittingPayment.set(true);

    this.expensePaymentsService
      .create(expense.id, {
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
          // El gasto ya trae paymentStatus/paidAmount/pendingAmount
          // actualizados al releerlo — no hace falta un segundo endpoint.
          this.load(expense.id);
          this.loadPayments(expense.id);
        },
        error: (err: HttpErrorResponse) => {
          this.submittingPayment.set(false);
          this.paymentErrorMessage.set(this.mapError(err));
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
