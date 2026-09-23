import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { WizardStepper } from '../../../shared/wizard-stepper/wizard-stepper';
import { CompaniesService } from '../../../core/services/companies';
import { CreateCompanyResponse } from '../../../core/models/company.model';
import { generatePassword } from '../../../shared/password-generator';
import { MODULE_PRESET_OPTIONS, MODULE_PRESETS, ModulePreset, ModulePresetValue } from '../../../shared/module-preset';

type WizardStep = 1 | 2 | 3;

const STEP_FIELDS: Record<WizardStep, string[]> = {
  1: ['companyName', 'industry', 'taxId', 'modulePreset'],
  2: ['adminFullName', 'adminEmail', 'adminPassword'],
  3: ['planCode', 'trialDays'],
};

@Component({
  selector: 'app-company-create-modal',
  imports: [ReactiveFormsModule, Modal, WizardStepper],
  templateUrl: './company-create-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyCreateModal {
  private fb = inject(FormBuilder);
  private companiesService = inject(CompaniesService);

  close = output<void>();
  created = output<CreateCompanyResponse>();

  step = signal<WizardStep>(1);
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

  presetOptions = MODULE_PRESET_OPTIONS;
  presets = MODULE_PRESETS;

  form = this.fb.group({
    companyName: ['', Validators.required],
    industry: [''],
    taxId: [''],
    modulePreset: [ModulePreset.inventory as ModulePresetValue, Validators.required],
    usesLots: [true],
    adminFullName: ['', Validators.required],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminPassword: ['', [Validators.required, Validators.minLength(8)]],
    planCode: [this.plans[0].code, Validators.required],
    trialDays: [15, [Validators.required, Validators.min(1)]],
  });

  // "Solo compran y venden" nunca usa lotes (no se pregunta multi-almacén ni
  // variantes en esta pantalla, tampoco). Al elegir producción/planta, el
  // checkbox arranca ON por defecto — el usuario lo puede apagar.
  onPresetChange(preset: ModulePresetValue) {
    this.form.controls.modulePreset.setValue(preset);
    this.form.controls.usesLots.setValue(preset !== ModulePreset.inventory);
  }

  next() {
    const fields = STEP_FIELDS[this.step()];
    const hasInvalid = fields.some(name => this.form.get(name)!.invalid);

    if (hasInvalid) {
      fields.forEach(name => this.form.get(name)!.markAsTouched());
      return;
    }

    this.step.update(s => (s < 3 ? ((s + 1) as WizardStep) : s));
  }

  back() {
    this.step.update(s => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  generate() {
    this.form.controls.adminPassword.setValue(generatePassword());
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
      // Si el paso final es válido pero un paso anterior no, volvemos ahí para que se vea el error.
      const brokenStep = ([1, 2, 3] as WizardStep[]).find(s =>
        STEP_FIELDS[s].some(name => this.form.get(name)!.invalid),
      );
      if (brokenStep) this.step.set(brokenStep);
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
        modulePreset: value.modulePreset!,
        usesLots: value.modulePreset === ModulePreset.inventory ? false : !!value.usesLots,
      })
      .subscribe({
        next: res => this.created.emit(res),
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(this.mapError(err));
        },
      });
  }

  private mapError(err: HttpErrorResponse): string {
    if (err.status === 400 && typeof err.error?.error !== 'string') {
      return 'Revisa los datos ingresados.';
    }
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al crear la empresa. Intenta nuevamente.';
  }
}
