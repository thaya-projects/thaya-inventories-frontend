import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { InfoHint } from '../../../shared/info-hint/info-hint';
import { PhoneField, phoneFieldValidator } from '../../../shared/phone-field/phone-field';
import { SuppliersService } from '../../../core/services/suppliers';
import { Supplier } from '../../../core/models/supplier.model';

// Para qué sirve cada dato (ícono "i").
const HINTS = {
  name: 'Nombre de la empresa o persona que te vende. Así aparece en compras y reportes. No se puede repetir.',
  contactName: 'La persona con quien hablas para hacer pedidos (ej. doña Eli, el vendedor).',
  phone: 'Para llamar o escribir por WhatsApp al hacer un pedido. En Bolivia son 8 dígitos.',
  email: 'Para enviarle pedidos o recibir facturas por correo.',
  taxId: 'NIT del proveedor, para tus registros contables y facturas.',
  city: 'Ciudad desde donde te despacha. Ayuda a planificar tiempos de entrega.',
  address: 'Dirección del local o depósito del proveedor, por si vas a recoger.',
} as const;

const normalize = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

@Component({
  selector: 'app-supplier-form-modal',
  imports: [ReactiveFormsModule, Modal, InfoHint, PhoneField],
  templateUrl: './supplier-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private suppliersService = inject(SuppliersService);
  private destroyRef = inject(DestroyRef);

  // null/omitido = alta. Con id = edición de ese proveedor.
  supplierId = input<string | null>(null);
  close = output<void>();
  saved = output<void>();

  hints = HINTS;
  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);
  // Proveedor que ya existe con el mismo nombre (el backend también lo rechaza al guardar).
  sameName = signal<Supplier | null>(null);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    contactName: [''],
    phone: [null as string | null, phoneFieldValidator],
    email: ['', Validators.email],
    city: [''],
    taxId: [''],
    address: [''],
  });

  ngOnInit(): void {
    this.form.controls.name.valueChanges
      .pipe(
        map(v => (v ?? '').trim()),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(name =>
          name.length < 3
            ? of(null)
            : this.suppliersService.list({ search: name }).pipe(
                map(list => list.find(s => s.id !== this.supplierId() && normalize(s.name) === normalize(name)) ?? null),
                catchError(() => of(null)),
              ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(match => this.sameName.set(match));

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
          phone: supplier.phone ?? null,
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
    if (this.sameName()) return;

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const payload = {
      name: value.name!.trim(),
      contactName: value.contactName?.trim() || null,
      phone: value.phone || null,
      email: value.email?.trim() || null,
      city: value.city?.trim() || null,
      taxId: value.taxId?.trim() || null,
      address: value.address?.trim() || null,
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
