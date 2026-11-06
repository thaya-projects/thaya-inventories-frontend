import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, map, merge, of, switchMap } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { InfoHint } from '../../../shared/info-hint/info-hint';
import { CustomersService } from '../../../core/services/customers';
import { Customer, CustomerDuplicate } from '../../../core/models/customer.model';

// Código de país del teléfono. Bolivia primero: es el caso normal.
const COUNTRIES = [
  { code: '591', label: 'Bolivia', digits: 8 },
  { code: '54', label: 'Argentina' },
  { code: '55', label: 'Brasil' },
  { code: '56', label: 'Chile' },
  { code: '51', label: 'Perú' },
  { code: '595', label: 'Paraguay' },
  { code: '1', label: 'EE. UU.' },
  { code: '34', label: 'España' },
] as const;

const BOLIVIA = '591';

// Para qué sirve cada dato (ícono "i").
const HINTS = {
  name: 'Nombre de la persona o razón social de la empresa. Así aparece en ventas, remisiones y reportes.',
  taxId: 'NIT de la empresa o CI de la persona (con extensión si tiene, ej. 4567890 SC). Identifica al cliente: no se puede registrar dos veces el mismo número.',
  phone: 'Celular o fijo. Sirve para contactar al cliente y avisarle por WhatsApp. En Bolivia son 8 dígitos.',
  email: 'Para enviarle comprobantes o avisos por correo.',
  city: 'Ciudad de entrega o de facturación. Ayuda a organizar despachos y ver ventas por ciudad.',
  address: 'Dirección de entrega: calle, número y referencia para el despacho.',
} as const;

function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  const digits = String(control.value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const country = parent?.get('phoneCountry')?.value ?? BOLIVIA;
  if (country === BOLIVIA) return digits.length === 8 ? null : { phone: 'En Bolivia el número tiene 8 dígitos (ej. 7123 4567).' };
  return digits.length >= 6 && digits.length <= 13 ? null : { phone: 'Revisa el número: entre 6 y 13 dígitos sin el código de país.' };
}

@Component({
  selector: 'app-customer-form-modal',
  imports: [ReactiveFormsModule, Modal, InfoHint],
  templateUrl: './customer-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private customersService = inject(CustomersService);
  private destroyRef = inject(DestroyRef);

  // null/omitido = alta. Con id = edición de ese cliente.
  customerId = input<string | null>(null);
  // Desde una venta: ofrecer "Usar este cliente" cuando ya existe.
  allowPickExisting = input(false);
  // Alta desde una búsqueda sin resultados: el nombre ya escrito llega precargado.
  initialName = input('');
  close = output<void>();
  saved = output<Customer>();
  picked = output<Customer>();

  hints = HINTS;
  countries = COUNTRIES;

  loading = signal(true);
  submitting = signal(false);
  picking = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  duplicates = signal<CustomerDuplicate[]>([]);
  // Avisos de teléfono/nombre que el usuario ya revisó y descartó ("es otro cliente").
  dismissed = signal(false);

  taxIdConflict = computed(() => this.duplicates().find(d => d.matches.includes('TaxId')) ?? null);
  softDuplicates = computed(() => (this.dismissed() ? [] : this.duplicates().filter(d => !d.matches.includes('TaxId'))));

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    taxId: [''],
    phoneCountry: [BOLIVIA as string],
    phone: ['', phoneValidator],
    email: ['', Validators.email],
    city: [''],
    address: [''],
  });

  isBolivia = signal(true);

  ngOnInit(): void {
    this.form.controls.phoneCountry.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(code => {
      this.isBolivia.set(code === BOLIVIA);
      this.form.controls.phone.updateValueAndValidity();
    });

    this.watchDuplicates();

    const id = this.customerId();
    if (!id) {
      const name = this.initialName().trim();
      // Si lo buscado es un número, probablemente es el teléfono o el NIT/CI, no el nombre.
      if (/^[\d\s.+-]{6,}$/.test(name)) {
        const digits = name.replace(/\D/g, '');
        if (digits.length === 8 && /^[67]/.test(digits)) this.form.patchValue({ phone: `${digits.slice(0, 4)} ${digits.slice(4)}` });
        else this.form.patchValue({ taxId: name });
      } else if (name) {
        this.form.patchValue({ name });
      }
      this.loading.set(false);
      return;
    }

    this.customersService.get(id).subscribe({
      next: customer => {
        const { country, number } = this.splitPhone(customer.phone);
        this.form.patchValue({
          name: customer.name,
          taxId: customer.taxId ?? '',
          phoneCountry: country,
          phone: number,
          email: customer.email ?? '',
          city: customer.city ?? '',
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

  // Mientras escribe: ¿ya existe alguien con este NIT/CI, teléfono o nombre?
  private watchDuplicates() {
    const c = this.form.controls;
    merge(c.name.valueChanges, c.taxId.valueChanges, c.phone.valueChanges, c.phoneCountry.valueChanges)
      .pipe(
        debounceTime(400),
        map(() => ({
          name: (c.name.value ?? '').trim(),
          taxId: (c.taxId.value ?? '').trim(),
          phone: c.phone.valid ? this.fullPhone() ?? '' : '',
        })),
        distinctUntilChanged((a, b) => a.name === b.name && a.taxId === b.taxId && a.phone === b.phone),
        switchMap(q =>
          q.name.length < 4 && !q.taxId && !q.phone
            ? of(null)
            : this.customersService.duplicates({ ...q, excludeId: this.customerId() }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: res => {
          this.duplicates.set(res?.duplicates ?? []);
          this.dismissed.set(false);
        },
        // Si la verificación falla, el backend igual bloquea el NIT/CI repetido al guardar.
        error: () => this.duplicates.set([]),
      });
  }

  // "7123 4567" mientras escribe (solo Bolivia, 8 dígitos).
  formatPhoneInput() {
    if (!this.isBolivia()) return;
    const digits = String(this.form.controls.phone.value ?? '').replace(/\D/g, '').slice(0, 8);
    const pretty = digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
    if (pretty !== this.form.controls.phone.value) this.form.controls.phone.setValue(pretty);
  }

  matchLabel(d: CustomerDuplicate): string {
    const parts: string[] = [];
    if (d.matches.includes('Phone')) parts.push('el mismo teléfono');
    if (d.matches.includes('Name')) parts.push('el mismo nombre');
    return parts.join(' y ');
  }

  pickExisting(d: CustomerDuplicate) {
    this.picking.set(d.id);
    this.customersService.get(d.id).subscribe({
      next: customer => this.picked.emit(customer),
      error: () => {
        this.picking.set(null);
        this.errorMessage.set('No se pudo cargar ese cliente.');
      },
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.taxIdConflict()) return;

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const payload = {
      name: value.name!.trim(),
      phone: this.fullPhone(),
      email: value.email?.trim() || null,
      city: value.city?.trim() || null,
      taxId: value.taxId?.trim() || null,
      address: value.address?.trim() || null,
    };

    const id = this.customerId();
    const request = id ? this.customersService.update(id, payload) : this.customersService.create(payload);

    request.subscribe({
      next: customer => this.saved.emit(customer),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
      },
    });
  }

  // "+591 71234567" — el backend lo guarda y compara en este formato.
  private fullPhone(): string | null {
    const digits = String(this.form.controls.phone.value ?? '').replace(/\D/g, '');
    if (!digits) return null;
    return `+${this.form.controls.phoneCountry.value} ${digits}`;
  }

  private splitPhone(phone: string | null): { country: string; number: string } {
    if (!phone) return { country: BOLIVIA, number: '' };
    const digits = phone.replace(/\D/g, '');
    const country = phone.trim().startsWith('+')
      ? (COUNTRIES.map(c => c.code as string).sort((a, b) => b.length - a.length).find(code => digits.startsWith(code)) ?? BOLIVIA)
      : BOLIVIA;
    const local = phone.trim().startsWith('+') ? digits.slice(country.length) : digits;
    const number = country === BOLIVIA && local.length === 8 ? `${local.slice(0, 4)} ${local.slice(4)}` : local;
    return { country, number };
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al guardar. Intenta nuevamente.';
  }
}
