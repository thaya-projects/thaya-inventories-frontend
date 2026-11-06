import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALUE_ACCESSOR, ValidationErrors } from '@angular/forms';

// Código de país. Bolivia primero: es el caso normal.
export const PHONE_COUNTRIES = [
  { code: '591', label: 'Bolivia' },
  { code: '54', label: 'Argentina' },
  { code: '55', label: 'Brasil' },
  { code: '56', label: 'Chile' },
  { code: '51', label: 'Perú' },
  { code: '595', label: 'Paraguay' },
  { code: '1', label: 'EE. UU.' },
  { code: '34', label: 'España' },
] as const;

const BOLIVIA = '591';

// "+591 71234567" → { country: '591', digits: '71234567' }. Sin "+": se asume Bolivia.
export function splitPhone(phone: string | null | undefined): { country: string; digits: string } {
  if (!phone) return { country: BOLIVIA, digits: '' };
  const all = phone.replace(/\D/g, '');
  if (!phone.trim().startsWith('+')) return { country: BOLIVIA, digits: all };
  const country =
    PHONE_COUNTRIES.map(c => c.code as string)
      .sort((a, b) => b.length - a.length)
      .find(code => all.startsWith(code)) ?? BOLIVIA;
  return { country, digits: all.slice(country.length) };
}

// Valida el valor completo ("+591 71234567"): Bolivia 8 dígitos; otros países 6 a 13.
export function phoneFieldValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string | null;
  if (!value) return null;
  const { country, digits } = splitPhone(value);
  if (country === BOLIVIA) return digits.length === 8 ? null : { phone: 'En Bolivia el número tiene 8 dígitos (ej. 7123 4567).' };
  return digits.length >= 6 && digits.length <= 13 ? null : { phone: 'Revisa el número: entre 6 y 13 dígitos sin el código de país.' };
}

// Campo de teléfono con código de país (+591 por defecto). Entrega "+591 71234567" (o null si está vacío),
// el mismo formato que guarda y compara el backend.
@Component({
  selector: 'app-phone-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneField), multi: true }],
  template: `
    <div
      class="flex overflow-hidden rounded-md border bg-gr-surface transition focus-within:ring-2 focus-within:ring-gr-primary/30"
      [class]="invalid() ? 'border-gr-danger' : 'border-gr-border focus-within:border-gr-primary'"
    >
      <span class="relative flex shrink-0 items-center gap-1 border-r border-gr-border-lite bg-gr-bg pr-2 pl-3 text-sm font-semibold text-gr-text tabular-nums">
        +{{ country() }}
        <svg class="h-3.5 w-3.5 text-gr-sub" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <select
          [value]="country()" (change)="onCountry($event)" [disabled]="disabled()" aria-label="Código de país"
          class="absolute inset-0 cursor-pointer opacity-0"
        >
          @for (c of countries; track c.code) {
            <option [value]="c.code">{{ c.label }} (+{{ c.code }})</option>
          }
        </select>
      </span>
      <input
        [id]="inputId()" type="tel" inputmode="tel" autocomplete="off"
        [placeholder]="country() === '591' ? '7123 4567' : 'Número sin código'"
        [value]="display()" (input)="onInput($event)" (blur)="onTouched()" [disabled]="disabled()"
        class="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-gr-text tabular-nums placeholder-gr-muted focus:outline-none"
      >
    </div>
  `,
})
export class PhoneField implements ControlValueAccessor {
  inputId = input('phone');
  invalid = input(false);

  countries = PHONE_COUNTRIES;
  country = signal<string>(BOLIVIA);
  display = signal('');
  disabled = signal(false);

  private onChange: (v: string | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    const { country, digits } = splitPhone(value);
    this.country.set(country);
    this.display.set(this.pretty(country, digits));
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  onCountry(event: Event) {
    this.country.set((event.target as HTMLSelectElement).value);
    this.emit(this.display().replace(/\D/g, ''));
  }

  onInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const max = this.country() === BOLIVIA ? 8 : 13;
    const digits = target.value.replace(/\D/g, '').slice(0, max);
    const pretty = this.pretty(this.country(), digits);
    this.display.set(pretty);
    if (target.value !== pretty) target.value = pretty;
    this.emit(digits);
  }

  private emit(digits: string) {
    this.onChange(digits ? `+${this.country()} ${digits}` : null);
  }

  // "7123 4567" mientras escribe (Bolivia).
  private pretty(country: string, digits: string): string {
    return country === BOLIVIA && digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
  }
}
