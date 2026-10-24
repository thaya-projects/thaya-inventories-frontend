import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { PaymentMethodsService } from '../../../core/services/payment-methods';
import { PaymentMethodType } from '../../../core/models/payment-method.model';

const TYPES: { value: PaymentMethodType; label: string }[] = [
  { value: 'Cash', label: 'Efectivo' },
  { value: 'Qr', label: 'QR' },
  { value: 'Transfer', label: 'Transferencia' },
  { value: 'Card', label: 'Tarjeta' },
  { value: 'Gateway', label: 'Pasarela' },
];

@Component({
  selector: 'app-payment-method-form-modal',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './payment-method-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private paymentMethodsService = inject(PaymentMethodsService);

  // null/omitido = alta. Con id = edición de ese método.
  methodId = input<string | null>(null);
  close = output<void>();
  saved = output<void>();

  types = TYPES;

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    name: ['', Validators.required],
    type: ['Cash' as PaymentMethodType, Validators.required],
    isDefault: [false],
    // details es libre — para el MVP solo Qr/Transfer piden datos puntuales.
    accountName: [''],
    accountNumber: [''],
    bank: [''],
  });

  ngOnInit(): void {
    const id = this.methodId();
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.paymentMethodsService.get(id).subscribe({
      next: method => {
        const details = method.details as Record<string, string | undefined>;
        this.form.patchValue({
          name: method.name,
          type: method.type,
          accountName: details['accountName'] ?? '',
          accountNumber: details['accountNumber'] ?? '',
          bank: details['bank'] ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el método de pago.');
        this.loading.set(false);
      },
    });
  }

  private buildDetails(): Record<string, unknown> {
    const value = this.form.getRawValue();

    switch (value.type) {
      case 'Qr':
        return { accountName: value.accountName || null, accountNumber: value.accountNumber || null };
      case 'Transfer':
        return {
          bank: value.bank || null,
          accountName: value.accountName || null,
          accountNumber: value.accountNumber || null,
        };
      default:
        return {};
    }
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const details = this.buildDetails();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const id = this.methodId();
    const request = id
      ? this.paymentMethodsService.update(id, { name: value.name!, type: value.type!, details })
      : this.paymentMethodsService.create({
          name: value.name!,
          type: value.type!,
          isDefault: value.isDefault!,
          details,
        });

    request.subscribe({
      next: () => this.saved.emit(),
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
