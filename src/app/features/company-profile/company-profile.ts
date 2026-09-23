import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyService } from '../../core/services/company';
import { CompanyContextService } from '../../core/services/company-context';
import { ToastService } from '../../shared/toast/toast.service';
import { subscriptionStatusBadgeClass, subscriptionStatusLabel } from '../../shared/subscription-status';
import { MODULE_PRESETS, inferPreset } from '../../shared/module-preset';

@Component({
  selector: 'app-company-profile',
  imports: [ReactiveFormsModule, DatePipe],
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

  // Onboarding consultora: el Admin ya no prende/apaga módulos — solo ve qué
  // paquete tiene, inferido de los settings que ya vinieron con la empresa.
  presetLabel = computed(() => MODULE_PRESETS[inferPreset(this.company()?.settings)].label);

  savingProfile = signal(false);
  savingLotSettings = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    industry: [''],
    taxId: [''],
    phone: [''],
    email: [''],
    city: [''],
    address: [''],
    logoUrl: [''],
  });

  lotSettingsForm = this.fb.nonNullable.group({
    lotCodeMode: ['auto' as 'auto' | 'manual'],
    lotCodePrefixMp: ['MP', Validators.maxLength(10)],
    lotCodePrefixPt: ['PT', Validators.maxLength(10)],
    includeProductCode: [false],
  });

  activeModules = computed(() => this.company()?.settings.activeModules ?? []);

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
        phone: c.phone ?? '',
        email: c.email ?? '',
        city: c.city ?? '',
        address: c.address ?? '',
        logoUrl: c.logoUrl ?? '',
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
        logoUrl: raw.logoUrl || null,
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
}
