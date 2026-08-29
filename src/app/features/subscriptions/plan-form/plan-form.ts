import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SubscriptionPlansService } from '../../../core/services/subscription-plans';
import { SavePlanRequest } from '../../../core/models/subscription-plan.model';

@Component({
  selector: 'app-plan-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './plan-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanForm {
  private fb = inject(FormBuilder);
  private plansService = inject(SubscriptionPlansService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  planId = this.route.snapshot.paramMap.get('id');
  isEditMode = !!this.planId;

  loading = signal(this.isEditMode);
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

  constructor() {
    if (this.planId) {
      this.plansService.get(this.planId).subscribe({
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
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    let features: Record<string, unknown> = {};
    if (value.featuresJson?.trim()) {
      try {
        features = JSON.parse(value.featuresJson);
      } catch {
        this.errorMessage.set('El campo "features" debe ser un JSON válido.');
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

    const request = this.planId
      ? this.plansService.update(this.planId, payload)
      : this.plansService.create(payload);

    request.subscribe({
      next: () => this.router.navigate(['/subscriptions/plans']),
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
