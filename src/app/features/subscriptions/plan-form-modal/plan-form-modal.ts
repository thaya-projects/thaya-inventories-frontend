import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { WizardStepper } from '../../../shared/wizard-stepper/wizard-stepper';
import { SubscriptionPlansService } from '../../../core/services/subscription-plans';
import { SavePlanRequest, SubscriptionPlan } from '../../../core/models/subscription-plan.model';

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Datos generales', 'Precios', 'Límites', 'Features'];

// Solo el paso 1 tiene campos requeridos — el resto es todo opcional, pero se
// valida igual por paso para que "Siguiente" se comporte consistente.
const STEP_FIELDS: Record<WizardStep, string[]> = {
  1: ['code', 'name'],
  2: ['priceMonthly', 'priceQuarterly', 'priceYearly'],
  3: ['maxUsers', 'maxProducts', 'maxStorageMb'],
  4: ['featuresJson'],
};

@Component({
  selector: 'app-plan-form-modal',
  imports: [ReactiveFormsModule, Modal, WizardStepper],
  templateUrl: './plan-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private plansService = inject(SubscriptionPlansService);

  // null/omitido = alta. Con id = edición de ese plan.
  planId = input<string | null>(null);
  close = output<void>();
  saved = output<SubscriptionPlan>();

  isEditMode = computed(() => !!this.planId());
  stepLabels = STEP_LABELS;

  step = signal<WizardStep>(1);
  loading = signal(false);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    description: [''],
    priceMonthly: [null as number | null],
    priceQuarterly: [null as number | null],
    priceYearly: [null as number | null],
    maxUsers: [null as number | null],
    maxProducts: [null as number | null],
    maxStorageMb: [null as number | null],
    // "features" no tiene schema fijo (objeto libre) — lo editamos como JSON crudo.
    featuresJson: ['{}'],
  });

  ngOnInit(): void {
    const id = this.planId();
    if (!id) return;

    this.loading.set(true);
    this.plansService.get(id).subscribe({
      next: plan => {
        this.form.patchValue({
          code: plan.code,
          name: plan.name,
          description: plan.description ?? '',
          priceMonthly: plan.priceMonthly,
          priceQuarterly: plan.priceQuarterly,
          priceYearly: plan.priceYearly,
          maxUsers: plan.maxUsers,
          maxProducts: plan.maxProducts,
          maxStorageMb: plan.maxStorageMb,
          featuresJson: JSON.stringify(plan.features ?? {}, null, 2),
        });
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el plan.');
        this.loading.set(false);
      },
    });
  }

  next() {
    const fields = STEP_FIELDS[this.step()];
    const hasInvalid = fields.some(name => this.form.get(name)!.invalid);

    if (hasInvalid) {
      fields.forEach(name => this.form.get(name)!.markAsTouched());
      return;
    }

    this.step.update(s => (s < 4 ? ((s + 1) as WizardStep) : s));
  }

  back() {
    this.step.update(s => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const brokenStep = ([1, 2, 3, 4] as WizardStep[]).find(s =>
        STEP_FIELDS[s].some(name => this.form.get(name)!.invalid),
      );
      if (brokenStep) this.step.set(brokenStep);
      return;
    }

    const value = this.form.getRawValue();

    let features: Record<string, unknown> = {};
    if (value.featuresJson?.trim()) {
      try {
        features = JSON.parse(value.featuresJson);
      } catch {
        this.errorMessage.set('El campo "features" debe ser un JSON válido.');
        this.step.set(4);
        return;
      }
    }

    const payload: SavePlanRequest = {
      code: value.code!,
      name: value.name!,
      description: value.description || undefined,
      priceMonthly: value.priceMonthly ?? undefined,
      priceQuarterly: value.priceQuarterly ?? undefined,
      priceYearly: value.priceYearly ?? undefined,
      maxUsers: value.maxUsers ?? undefined,
      maxProducts: value.maxProducts ?? undefined,
      maxStorageMb: value.maxStorageMb ?? undefined,
      features,
    };

    this.errorMessage.set(null);
    this.submitting.set(true);

    const id = this.planId();
    const request = id ? this.plansService.update(id, payload) : this.plansService.create(payload);

    request.subscribe({
      next: plan => this.saved.emit(plan),
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
    return 'Ocurrió un error al guardar el plan. Intenta nuevamente.';
  }
}
