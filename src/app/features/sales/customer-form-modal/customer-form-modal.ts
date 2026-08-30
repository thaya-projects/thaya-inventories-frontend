import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { CustomersService } from '../../../core/services/customers';

@Component({
  selector: 'app-customer-form-modal',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './customer-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private customersService = inject(CustomersService);

  // null/omitido = alta. Con id = edición de ese cliente.
  customerId = input<string | null>(null);
  close = output<void>();
  saved = output<void>();

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    name: ['', Validators.required],
    phone: [''],
    email: [''],
    city: [''],
    taxId: [''],
    address: [''],
  });

  ngOnInit(): void {
    const id = this.customerId();
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.customersService.get(id).subscribe({
      next: customer => {
        this.form.patchValue({
          name: customer.name,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          city: customer.city ?? '',
          taxId: customer.taxId ?? '',
          address: customer.address ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el cliente.');
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
      name: value.name!,
      phone: value.phone || null,
      email: value.email || null,
      city: value.city || null,
      taxId: value.taxId || null,
      address: value.address || null,
    };

    const id = this.customerId();
    const request = id ? this.customersService.update(id, payload) : this.customersService.create(payload);

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
