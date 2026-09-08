import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from '../modal/modal';
import { generatePassword } from '../password-generator';

export interface ResetPasswordResult {
  email: string | null;
  password: string;
}

// Pieza reutilizable: password + confirmar + Generar + submit, dentro de un
// Modal. Un solo componente para "Restablecer contraseña" tanto en el detalle
// de empresa (SuperAdmin, requiere confirmar el email del admin — el endpoint
// lo pide en el body) como en Equipo (Admin resetea a un miembro por su id,
// el endpoint no pide email). El componente no sabe a qué endpoint pegar:
// emite (confirmed) con lo elegido y el padre hace el POST correspondiente.
@Component({
  selector: 'app-reset-password-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './reset-password-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordModal implements OnInit {
  title = input('Restablecer contraseña');
  // true: el email va en el body (POST reset-admin-password) y queda editable
  // para que el SuperAdmin lo confirme — no hay garantía de que Company.email
  // sea el correo del Admin. false: el id ya va en la URL, no se pide email.
  requireEmail = input(false);
  emailValue = input<string | null>(null);
  submitting = input(false);

  close = output<void>();
  confirmed = output<ResetPasswordResult>();

  private fb = inject(FormBuilder);

  showPassword = signal(false);
  copied = signal(false);
  mismatch = signal(false);

  form = this.fb.group({
    email: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  ngOnInit() {
    if (this.requireEmail()) {
      const emailControl = this.form.controls.email;
      emailControl.setValue(this.emailValue() ?? '');
      emailControl.setValidators([Validators.required, Validators.email]);
      emailControl.updateValueAndValidity();
    }
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  generate() {
    const value = generatePassword(8);
    this.form.patchValue({ password: value, confirmPassword: value });
    this.showPassword.set(true);
    this.mismatch.set(false);
    this.copied.set(false);
  }

  async copyPassword() {
    const value = this.form.controls.password.value;
    if (!value) return;

    await navigator.clipboard.writeText(value);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.mismatch.set(true);
      return;
    }

    this.mismatch.set(false);
    this.confirmed.emit({ email: this.requireEmail() ? email! : null, password: password! });
  }
}
