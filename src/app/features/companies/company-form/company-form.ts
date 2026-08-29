import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CompaniesService } from '../../../core/services/companies';
import { generatePassword } from '../../../shared/password-generator';

@Component({
  selector: 'app-company-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './company-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyForm {
  private fb = inject(FormBuilder);
  private companiesService = inject(CompaniesService);
  private router = inject(Router);

  submitting = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);
  copied = signal(false);

  // TODO: reemplazar por un GET real a /api/platform/plans cuando exista ese endpoint.
  plans = [
    { code: 'basic', name: 'Básico' },
    { code: 'pro', name: 'Profesional' },
    { code: 'enterprise', name: 'Empresarial' },
  ];

  form = this.fb.group({
    companyName: ['', Validators.required],
    industry: [''],
    taxId: [''],
    adminFullName: ['', Validators.required],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminPassword: ['', [Validators.required, Validators.minLength(8)]],
    planCode: [this.plans[0].code, Validators.required],
    trialDays: [15, [Validators.required, Validators.min(1)]],
  });

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  generate() {
    this.form.controls.adminPassword.setValue(generatePassword(8));
    this.showPassword.set(true);
    this.copied.set(false);
  }

  async copyPassword() {
    const value = this.form.controls.adminPassword.value;
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

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.companiesService
      .create({
        companyName: value.companyName!,
        industry: value.industry || undefined,
        taxId: value.taxId || undefined,
        adminFullName: value.adminFullName!,
        adminEmail: value.adminEmail!,
        adminPassword: value.adminPassword!,
        planCode: value.planCode!,
        trialDays: value.trialDays!,
      })
      .subscribe({
        next: res => this.router.navigate(['/companies', res.companyId]),
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(this.mapError(err));
        },
      });
  }

  private mapError(err: HttpErrorResponse): string {
    if (err.status === 400) {
      return 'Revisa los datos ingresados.';
    }
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al crear la empresa. Intenta nuevamente.';
  }
}
