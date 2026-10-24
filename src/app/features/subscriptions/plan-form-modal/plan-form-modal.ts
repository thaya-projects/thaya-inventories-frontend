import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { WizardStepper } from '../../../shared/wizard-stepper/wizard-stepper';
import { SubscriptionPlansService } from '../../../core/services/subscription-plans';
import { CreatePlanRequest, SavePlanRequest, SubscriptionPlan } from '../../../core/models/subscription-plan.model';
import {
  MODULE_PRESET_OPTIONS,
  MODULE_PRESETS,
  ModulePreset,
  ModulePresetValue,
  presetToFeatureFlags,
} from '../../../shared/module-preset';

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Datos generales', 'Precios', 'Límites', 'Features'];

const MAX_CODE_LENGTH = 50;

// Mismo algoritmo que SubscriptionPlanCodeService (backend), confirmado
// campo por campo: trim → minúsculas → sin tildes → todo lo que no sea
// a-z0-9 se colapsa en un solo guion → se recortan guiones de punta →
// fallback "plan" si no queda nada → tope de 50 caracteres sin guion
// colgando. El chequeo de unicidad (-2, -3...) es solo del backend — esto
// nunca se manda cuando el código sigue auto-sincronizado (ver
// onNameInput()/submit()), así que no hace falta duplicar esa parte acá.
function slugify(name: string): string {
  let slug = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) slug = 'plan';
  if (slug.length > MAX_CODE_LENGTH) {
    slug = slug.slice(0, MAX_CODE_LENGTH).replace(/-+$/g, '');
  }

  return slug;
}

// Al editar un plan, intenta reconocer qué preset dejó marcado la última vez
// — solo si "production" está explícitamente en true (si no, es ambiguo:
// puede ser "Compran y venden" o un plan armado a mano que nunca pasó
// por acá, y no vale la pena adivinar mal). Nunca se infiere "inventory".
function inferPresetFromFeatures(features: Record<string, unknown>): ModulePresetValue | null {
  if (features['production'] !== true) return null;
  return features['loaders'] === true ? ModulePreset.plant : ModulePreset.production;
}

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

  presetOptions = MODULE_PRESET_OPTIONS;
  presets = MODULE_PRESETS;
  showAdvancedFeatures = signal(false);
  // Selección única de verdad — no un botón de "aplicar" suelto. Elegir otro
  // preset reemplaza al anterior, nunca se acumulan features de varios.
  selectedPreset = signal<ModulePresetValue | null>(null);

  // Mientras esto sea true, el campo "code" se rellena solo a partir de
  // "name" (ver onNameInput) y al guardar se manda null para que el backend
  // genere el definitivo y resuelva choques con el sufijo -2/-3. Se apaga en
  // cuanto el usuario escribe algo a mano en "code" (onCodeInput) — a partir
  // de ahí se respeta y se manda exactamente lo que puso.
  codeAutoSynced = signal(true);

  form = this.fb.group({
    // code: requerido solo al editar — ver ngOnInit(). Al crear, el backend
    // lo autogenera a partir de "name" si se deja vacío.
    code: [''],
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

    // Editar un plan existente sigue exigiendo code a mano (sin autogenerar);
    // crear uno nuevo lo deja opcional.
    if (id) {
      this.form.controls.code.setValidators(Validators.required);
      this.form.controls.code.updateValueAndValidity();
    }

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
        this.selectedPreset.set(inferPresetFromFeatures(plan.features ?? {}));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el plan.');
        this.loading.set(false);
      },
    });
  }

  // Genera el código en vivo mientras el usuario escribe el nombre — solo si
  // todavía no lo tocó a mano (editar un plan existente nunca auto-sincroniza).
  onNameInput() {
    if (this.isEditMode() || !this.codeAutoSynced()) return;

    const name = this.form.controls.name.value?.trim() ?? '';
    this.form.controls.code.setValue(name ? slugify(name) : '');
  }

  // Primer toque manual del usuario en "code" — a partir de acá se respeta
  // lo que escriba, nunca más se pisa desde onNameInput().
  onCodeInput() {
    this.codeAutoSynced.set(false);
  }

  // Onboarding consultora: elegir un preset rellena "features" con esas keys
  // (mismo mapa que MODULE_PRESETS, traducido a nombres cortos — ver
  // presetToFeatureFlags), sin pisar otras keys que el plan ya tuviera en su
  // JSON (merge, no reemplazo — "features" es un objeto libre sin schema).
  applyPreset(preset: ModulePresetValue) {
    this.selectedPreset.set(preset);

    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(this.form.controls.featuresJson.value || '{}');
    } catch {
      current = {};
    }

    const merged = { ...current, ...presetToFeatureFlags(preset) };
    this.form.controls.featuresJson.setValue(JSON.stringify(merged, null, 2));
  }

  toggleAdvancedFeatures() {
    this.showAdvancedFeatures.update(v => !v);
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

    const basePayload = {
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
    // Si "code" sigue auto-sincronizado (el usuario nunca lo tocó a mano),
    // lo que se ve en el input es solo una vista previa — se manda null para
    // que el backend genere el definitivo y resuelva choques con -2/-3.
    const codeToSend = this.codeAutoSynced() ? null : value.code?.trim() || null;
    const request = id
      ? this.plansService.update(id, { ...basePayload, code: value.code! } satisfies SavePlanRequest)
      : this.plansService.create({ ...basePayload, code: codeToSend } satisfies CreatePlanRequest);

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
