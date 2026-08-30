import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyService } from '../../core/services/company';
import { CompanyContextService } from '../../core/services/company-context';
import { CompanySettings } from '../../core/models/company-profile.model';
import { ToastService } from '../../shared/toast/toast.service';
import { subscriptionStatusBadgeClass } from '../../shared/subscription-status';

interface SettingToggle {
  key: keyof CompanySettings;
  label: string;
  hint: string;
}

const SETTINGS_TOGGLES: SettingToggle[] = [
  { key: 'usesMultiWarehouse', label: 'Multi-almacén', hint: 'Habilita el módulo de Almacenes en Inventario.' },
  { key: 'usesProduction', label: 'Producción', hint: 'Órdenes de producción y consumo de insumos.' },
  { key: 'usesLots', label: 'Lotes', hint: 'Seguimiento de productos por lote.' },
  { key: 'usesVariants', label: 'Variantes', hint: 'Productos con variantes (talla, color, etc).' },
  { key: 'usesWeight', label: 'Peso', hint: 'Productos que se venden o compran por peso.' },
  { key: 'usesLoaders', label: 'Cargadores', hint: 'Asignar cargadores a movimientos de almacén.' },
];

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
  toggles = SETTINGS_TOGGLES;

  savingProfile = signal(false);
  savingSetting = signal<string | null>(null);

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
    });
  }

  isChecked(key: keyof CompanySettings): boolean {
    return this.company()?.settings[key] === true;
  }

  toggleSetting(key: keyof CompanySettings) {
    const current = this.company();
    if (!current || this.savingSetting()) return;

    this.savingSetting.set(key);
    const nextSettings = { ...current.settings, [key]: !this.isChecked(key) };

    this.companyService.updateSettings({ settings: nextSettings }).subscribe({
      next: updated => {
        this.companyContext.setCompany(updated);
        this.savingSetting.set(null);
        this.toast.success('Configuración actualizada.');
      },
      error: () => {
        this.savingSetting.set(null);
        this.toast.error('No se pudo actualizar la configuración.');
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
