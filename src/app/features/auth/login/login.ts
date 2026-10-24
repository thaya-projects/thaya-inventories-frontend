import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  showPassword = signal(false);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
    remember: [false],
  });

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { identifier, password, remember } = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.auth.login(identifier!, password!, !!remember).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
      },
    });
  }

  // Códigos según el contrato del endpoint: 401/423/402/403/409 devuelven
  // { error: "mensaje" } ya redactado para mostrar directo. 400 (body inválido)
  // trae el detalle de validación de ASP.NET Core, no un mensaje para el usuario.
  private mapError(err: HttpErrorResponse): string {
    if (err.status === 400) {
      return 'Revisa los datos ingresados.';
    }
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al iniciar sesión. Intenta nuevamente.';
  }
}
