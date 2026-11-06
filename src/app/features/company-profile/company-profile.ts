import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CompanyService } from '../../core/services/company';
import { CompanyContextService } from '../../core/services/company-context';
import { ToastService } from '../../shared/toast/toast.service';
import { subscriptionStatusBadgeClass, subscriptionStatusLabel } from '../../shared/subscription-status';
import { billingCycleLabel } from '../../shared/billing-cycle';
import { MODULE_PRESETS, inferPreset } from '../../shared/module-preset';
import { logoFileError } from '../../shared/logo-upload';

// "activeModules" es un string[] libre (CompanySettings.activeModules, sin
// schema fijo) — no es el mismo catálogo tipado que CompanySubscriptionFeatures.
// Clave ausente del mapa = se muestra tal cual vino, para no ocultar un
// módulo nuevo que el backend agregue y todavía no tradujimos acá.
const MODULE_LABELS: Record<string, string> = {
  inventory: 'Inventario',
  purchases: 'Compras',
  sales: 'Ventas',
  production: 'Producción',
  cash: 'Caja',
  expenses: 'Gastos',
  reports: 'Reportes',
  loaders: 'Cargadores',
  multiWarehouse: 'Multi-almacén',
  aiAgents: 'Agentes IA',
};

import { PhoneField, phoneFieldValidator } from '../../shared/phone-field/phone-field';

@Component({
  selector: 'app-company-profile',
  imports: [ReactiveFormsModule, DatePipe, PhoneField],
  templateUrl: './company-profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyProfilePage {
  private companyService = inject(CompanyService);
  private companyContext = inject(CompanyContextService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  company = this.companyContext.company;
  subscription = this.companyContext.subscription;
  loading = this.companyContext.loading;

  statusBadgeClass = subscriptionStatusBadgeClass;
  statusLabel = subscriptionStatusLabel;
  billingCycleLabel = billingCycleLabel;
  moduleLabel = (key: string) => MODULE_LABELS[key] ?? key;

  // Onboarding consultora: el Admin ya no prende/apaga módulos — solo ve qué
  // paquete tiene, inferido de los settings que ya vinieron con la empresa.
  presetLabel = computed(() => MODULE_PRESETS[inferPreset(this.company()?.settings)].label);

  showMpPrefix = computed(() => this.company()?.settings.usesProduction === true);

  savingProfile = signal(false);
  savingLotSettings = signal(false);
  uploadingLogo = signal(false);
  logoError = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    industry: [''],
    taxId: [''],
    phone: [null as string | null, phoneFieldValidator],
    email: [''],
    city: [''],
    address: [''],
  });

  lotSettingsForm = this.fb.nonNullable.group({
    lotCodeMode: ['auto' as 'auto' | 'manual'],
    lotCodePrefixMp: ['MP', Validators.maxLength(10)],
    lotCodePrefixPt: ['PT', Validators.maxLength(10)],
    includeProductCode: [false],
  });

  activeModules = computed(() => this.company()?.settings.activeModules ?? []);

  setLotCodeMode(mode: 'auto' | 'manual') {
    this.lotSettingsForm.controls.lotCodeMode.setValue(mode);
  }

  // Ejemplo ilustrativo, no el formato exacto garantizado por el backend —
  // solo para que se entienda dónde entra el prefijo y el código de producto.
  private lotCodeExample(prefix: string): string {
    const clean = prefix?.trim() || 'LOTE';
    return this.lotSettingsForm.controls.includeProductCode.value
      ? `${clean}-COD123-0001`
      : `${clean}-0001`;
  }

  mpCodeExample(): string {
    return this.lotCodeExample(this.lotSettingsForm.controls.lotCodePrefixMp.value);
  }

  ptCodeExample(): string {
    return this.lotCodeExample(this.lotSettingsForm.controls.lotCodePrefixPt.value);
  }

  private formHydrated = false;

  constructor() {
    // El contexto puede llegar más tarde que este componente (fetch en curso
    // desde Shell). Hidratar el form una sola vez, cuando company() aparezca
    // — así un toggle de settings (que también actualiza company()) no pisa
    // texto que el usuario esté editando en el form.
    effect(() => {
      const c = this.company();
      if (!c || this.formHydrated) return;
      this.formHydrated = true;

      this.form.reset({
        name: c.name,
        industry: c.industry ?? '',
        taxId: c.taxId ?? '',
        phone: c.phone ?? null,
        email: c.email ?? '',
        city: c.city ?? '',
        address: c.address ?? '',
      });

      this.lotSettingsForm.reset({
        lotCodeMode: c.settings.lotCodeMode === 'auto' ? 'auto' : 'manual',
        lotCodePrefixMp: c.settings.lotCodePrefixMp || 'MP',
        lotCodePrefixPt: c.settings.lotCodePrefixPt || 'PT',
        includeProductCode: c.settings.includeProductCode === true,
      });
    });
  }

  saveLotSettings() {
    if (this.lotSettingsForm.invalid) {
      this.lotSettingsForm.markAllAsTouched();
      return;
    }

    const raw = this.lotSettingsForm.getRawValue();
    this.savingLotSettings.set(true);

    // El PUT hace merge server-side — mandar solo estas 4 keys no pisa el resto de settings.
    this.companyService
      .updateSettings({
        settings: {
          lotCodeMode: raw.lotCodeMode,
          lotCodePrefixMp: raw.lotCodePrefixMp || 'MP',
          lotCodePrefixPt: raw.lotCodePrefixPt || 'PT',
          includeProductCode: raw.includeProductCode,
        },
      })
      .subscribe({
        next: updated => {
          this.companyContext.setCompany(updated);
          this.savingLotSettings.set(false);
          this.toast.success('Configuración de lotes actualizada.');
        },
        error: () => {
          this.savingLotSettings.set(false);
          this.toast.error('No se pudo guardar la configuración de lotes.');
        },
      });
  }

  saveProfile() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.savingProfile.set(true);

    this.companyService
      .update({
        name: raw.name,
        industry: raw.industry || null,
        taxId: raw.taxId || null,
        phone: raw.phone || null,
        email: raw.email || null,
        city: raw.city || null,
        address: raw.address || null,
        // No editable acá — PUT es full-replace, se reenvía el valor actual.
        logoUrl: this.company()?.logoUrl ?? null,
      })
      .subscribe({
        next: updated => {
          this.companyContext.setCompany(updated);
          this.savingProfile.set(false);
          this.toast.success('Datos de la empresa actualizados.');
        },
        error: () => {
          this.savingProfile.set(false);
          this.toast.error('No se pudieron guardar los cambios.');
        },
      });
  }

  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const error = logoFileError(file);
    if (error) {
      this.logoError.set(error);
      return;
    }

    this.logoError.set(null);
    this.uploadingLogo.set(true);

    this.companyService.uploadLogo(file).subscribe({
      next: updated => {
        this.companyContext.setCompany(updated);
        this.uploadingLogo.set(false);
        this.toast.success('Logo actualizado.');
      },
      error: (err: HttpErrorResponse) => {
        this.uploadingLogo.set(false);
        this.logoError.set(typeof err.error?.error === 'string' ? err.error.error : 'No se pudo subir el logo.');
      },
    });
  }
}
