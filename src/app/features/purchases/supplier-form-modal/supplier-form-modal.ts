import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { SuppliersService } from '../../../core/services/suppliers';

@Component({
  selector: 'app-supplier-form-modal',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './supplier-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private suppliersService = inject(SuppliersService);

  // null/omitido = alta. Con id = edición de ese proveedor.
  supplierId = input<string | null>(null);
  close = output<void>();
  saved = output<void>();

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    name: ['', Validators.required],
    contactName: [''],
    phone: [''],
    email: [''],
    city: [''],
    taxId: [''],
    address: [''],
  });

  ngOnInit(): void {
    const id = this.supplierId();
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.suppliersService.get(id).subscribe({
      next: supplier => {
        this.form.patchValue({
          name: supplier.name,
          contactName: supplier.contactName ?? '',
          phone: supplier.phone ?? '',
          email: supplier.email ?? '',
          city: supplier.city ?? '',
          taxId: supplier.taxId ?? '',
          address: supplier.address ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el proveedor.');
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
      contactName: value.contactName || null,
      phone: value.phone || null,
      email: value.email || null,
      city: value.city || null,
      taxId: value.taxId || null,
      address: value.address || null,
    };

    const id = this.supplierId();
    const request = id ? this.suppliersService.update(id, payload) : this.suppliersService.create(payload);

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
