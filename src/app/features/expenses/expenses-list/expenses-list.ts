import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { ExpensesService } from '../../../core/services/expenses';
import { Expense, ExpenseCategory, ExpensePaymentStatus } from '../../../core/models/expense.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ExpenseFormModal } from '../expense-form-modal/expense-form-modal';

type PaidFilter = 'all' | 'paid' | 'unpaid';

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

// paymentStatus de gastos viene en minúscula (único caso en el backend) —
// mapeo propio, no compartir con el de /cash/payments (ese es PascalCase).
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

@Component({
  selector: 'app-expenses-list',
  imports: [DataTable, RouterLink, DatePipe, ConfirmDialog, ExpenseFormModal],
  templateUrl: './expenses-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesList {
  private expensesService = inject(ExpensesService);
  private toast = inject(ToastService);

  expenses = signal<Expense[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  paidFilter = signal<PaidFilter>('all');
  deletingId = signal<string | null>(null);

  showFormModal = signal(false);
  editingExpenseId = signal<string | null>(null);

  categoryLabel = (category: string) => CATEGORY_LABELS[category as ExpenseCategory] ?? category;
  statusLabel = (status: string) => PAYMENT_STATUS_LABELS[status as ExpensePaymentStatus] ?? status;
  statusBadgeClass = (status: string) =>
    PAYMENT_STATUS_BADGE_CLASS[status as ExpensePaymentStatus] ?? 'bg-gr-border-lite text-gr-sub';

  private dateTpl = viewChild.required<TemplateRef<{ $implicit: Expense }>>('dateTpl');
  private categoryTpl = viewChild.required<TemplateRef<{ $implicit: Expense }>>('categoryTpl');
  private amountTpl = viewChild.required<TemplateRef<{ $implicit: Expense }>>('amountTpl');
  private statusTpl = viewChild.required<TemplateRef<{ $implicit: Expense }>>('statusTpl');
  private pendingTpl = viewChild.required<TemplateRef<{ $implicit: Expense }>>('pendingTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Expense }>>('actionsTpl');

  columns = computed<DataTableColumn<Expense>[]>(() => [
    { key: 'date', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'category', label: 'Categoría', cellTemplate: this.categoryTpl() },
    { key: 'description', label: 'Descripción' },
    { key: 'amount', label: 'Monto', cellTemplate: this.amountTpl() },
    { key: 'paymentStatus', label: 'Estado', cellTemplate: this.statusTpl() },
    { key: 'pendingAmount', label: 'Pendiente', cellTemplate: this.pendingTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const filter = this.paidFilter();
    const paid = filter === 'all' ? undefined : filter === 'paid';

    this.expensesService.list(this.page(), this.pageSize(), { paid }).subscribe({
      next: result => {
        this.expenses.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de gastos.');
        this.loading.set(false);
      },
    });
  }

  setPaidFilter(filter: PaidFilter) {
    this.paidFilter.set(filter);
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
    this.editingExpenseId.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(expense: Expense) {
    this.editingExpenseId.set(expense.id);
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  onExpenseSaved() {
    this.showFormModal.set(false);
    this.toast.success(this.editingExpenseId() ? 'Gasto actualizado.' : 'Gasto creado.');
    this.load();
  }

  deleteTarget = signal<Expense | null>(null);

  askDelete(expense: Expense) {
    this.deleteTarget.set(expense);
  }

  closeDeleteConfirm() {
    if (this.deletingId()) return;
    this.deleteTarget.set(null);
  }

  confirmDelete() {
    const expense = this.deleteTarget();
    if (!expense) return;

    this.deletingId.set(expense.id);
    this.expensesService.delete(expense.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.deleteTarget.set(null);
        this.toast.success('Gasto eliminado.');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
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
