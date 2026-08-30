import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { ExpensesService } from '../../../core/services/expenses';
import { Expense, ExpenseCategory } from '../../../core/models/expense.model';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'Transport', label: 'Transporte' },
  { value: 'Utilities', label: 'Servicios básicos' },
  { value: 'Labor', label: 'Mano de obra' },
  { value: 'Maintenance', label: 'Mantenimiento' },
  { value: 'RawMaterial', label: 'Materia prima' },
  { value: 'Administrative', label: 'Administrativo' },
  { value: 'Taxes', label: 'Impuestos' },
  { value: 'Other', label: 'Otros' },
];

@Component({
  selector: 'app-expense-form-modal',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './expense-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private expensesService = inject(ExpensesService);

  // null/omitido = alta. Con id = edición de ese gasto.
  expenseId = input<string | null>(null);
  close = output<void>();
  saved = output<Expense>();

  categories = CATEGORIES;

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  today = new Date().toISOString().slice(0, 10);

  form = this.fb.group({
    date: [this.today, Validators.required],
    category: ['Other' as ExpenseCategory, Validators.required],
    description: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    voucher: [''],
  });

  ngOnInit(): void {
    const id = this.expenseId();
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.expensesService.get(id).subscribe({
      next: expense => {
        this.form.patchValue({
          date: expense.date?.slice(0, 10) ?? this.today,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          voucher: expense.voucher ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el gasto.');
        this.loading.set(false);
      },
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const payload = {
      date: value.date!,
      category: value.category!,
      description: value.description!,
      amount: value.amount!,
      voucher: value.voucher || null,
      // Upload de comprobante (imagen) no entra en este sprint.
      voucherImageUrl: null,
      sourceType: null,
      sourceId: null,
    };

    const id = this.expenseId();
    const request = id ? this.expensesService.update(id, payload) : this.expensesService.create(payload);

    request.subscribe({
      next: expense => this.saved.emit(expense),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al guardar. Intenta nuevamente.';
  }
}
