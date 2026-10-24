import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ResetPasswordModal, ResetPasswordResult } from '../../../shared/reset-password-modal/reset-password-modal';
import { CompaniesService } from '../../../core/services/companies';
import { Company } from '../../../core/models/company.model';
import { subscriptionStatusBadgeClass, subscriptionStatusLabel } from '../../../shared/subscription-status';
import { MODULE_PRESET_OPTIONS, MODULE_PRESETS, ModulePresetValue, inferPreset } from '../../../shared/module-preset';
import { logoFileError } from '../../../shared/logo-upload';
import { ToastService } from '../../../shared/toast/toast.service';

// Recibe la empresa directo del row de companies-list (GET /platform/companies
// y GET /platform/companies/{id} comparten el mismo shape Company) — no hace
// falta un segundo fetch solo para pintar el modal.
@Component({
  selector: 'app-company-detail-modal',
  imports: [Modal, DatePipe, ConfirmDialog, ResetPasswordModal],
  templateUrl: './company-detail-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyDetailModal implements OnInit {
  private companiesService = inject(CompaniesService);
  private toast = inject(ToastService);

  company = input.required<Company>();
  close = output<void>();
  updated = output<Company>();

  current = signal<Company | null>(null);
  errorMessage = signal<string | null>(null);

  resetModalOpen = signal(false);
  resettingPassword = signal(false);

  statusBadgeClass = subscriptionStatusBadgeClass;
  statusLabel = subscriptionStatusLabel;

  uploadingLogo = signal(false);
  logoError = signal<string | null>(null);

  // Cambiar paquete de módulos (PATCH .../module-preset) — mismos radios que
  // el alta de empresa, hidratados con el paquete inferido de settings.
  presetOptions = MODULE_PRESET_OPTIONS;
  presets = MODULE_PRESETS;
  selectedPreset = signal<ModulePresetValue>('inventory');
  usesLotsChecked = signal(false);
  savingPreset = signal(false);
  presetConfirmOpen = signal(false);

  hasPresetChanges = computed(() => {
    const current = this.current();
    if (!current) return false;
    const inferred = inferPreset(current.settings);
    const currentUsesLots = current.settings.usesLots === true;
    return this.selectedPreset() !== inferred || this.usesLotsChecked() !== currentUsesLots;
  });

  ngOnInit(): void {
    const company = this.company();
    this.current.set(company);
    this.selectedPreset.set(inferPreset(company.settings));
    this.usesLotsChecked.set(company.settings.usesLots === true);
  }

  onPresetChange(preset: ModulePresetValue) {
    this.selectedPreset.set(preset);
    this.usesLotsChecked.set(preset !== 'inventory');
  }

  askSavePreset() {
    if (!this.hasPresetChanges()) return;
    this.presetConfirmOpen.set(true);
  }

  closePresetConfirm() {
    if (this.savingPreset()) return;
    this.presetConfirmOpen.set(false);
  }

  confirmSavePreset() {
    const current = this.current();
    if (!current) return;

    this.savingPreset.set(true);
    this.companiesService
      .changeModulePreset(current.id, {
        modulePreset: this.selectedPreset(),
        usesLots: this.selectedPreset() === 'inventory' ? false : this.usesLotsChecked(),
      })
      .subscribe({
        next: updated => {
          this.current.set(updated);
          this.savingPreset.set(false);
          this.presetConfirmOpen.set(false);
          this.toast.success('Paquete de módulos actualizado.');
          this.updated.emit(updated);
        },
        error: (err: HttpErrorResponse) => {
          this.savingPreset.set(false);
          this.toast.error(this.mapPresetError(err));
        },
      });
  }

  savingStorefront = signal(false);

  toggleStorefront() {
    const current = this.current();
    if (!current) return;

    const enable = current.settings.hasPublicStorefront !== true;
    this.savingStorefront.set(true);
    this.companiesService.setStorefront(current.id, enable).subscribe({
      next: updated => {
        this.current.set(updated);
        this.savingStorefront.set(false);
        this.toast.success(enable ? 'Landing pública activada.' : 'Landing pública desactivada.');
        this.updated.emit(updated);
      },
      error: (err: HttpErrorResponse) => {
        this.savingStorefront.set(false);
        this.toast.error(typeof err.error?.error === 'string' ? err.error.error : 'No se pudo actualizar la landing pública.');
      },
    });
  }

  private mapPresetError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'No se pudo actualizar el paquete de módulos.';
  }

  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    const current = this.current();
    if (!file || !current) return;

    const error = logoFileError(file);
    if (error) {
      this.logoError.set(error);
      return;
    }

    this.logoError.set(null);
    this.uploadingLogo.set(true);

    this.companiesService.uploadLogo(current.id, file).subscribe({
      next: res => {
        const updated = { ...current, logoUrl: res.logoUrl };
        this.current.set(updated);
        this.uploadingLogo.set(false);
        this.toast.success('Logo actualizado.');
        this.updated.emit(updated);
      },
      error: (err: HttpErrorResponse) => {
        this.uploadingLogo.set(false);
        this.logoError.set(typeof err.error?.error === 'string' ? err.error.error : 'No se pudo subir el logo.');
      },
    });
  }

  openResetModal() {
    this.resetModalOpen.set(true);
  }

  closeResetModal() {
    if (this.resettingPassword()) return;
    this.resetModalOpen.set(false);
  }

  resetAdminPassword(result: ResetPasswordResult) {
    const current = this.current();
    if (!current || !result.email) return;

    this.resettingPassword.set(true);
    this.companiesService.resetAdminPassword(current.id, result.email, result.password).subscribe({
      next: res => {
        this.resettingPassword.set(false);
        this.resetModalOpen.set(false);
        this.toast.success(`Se restableció la contraseña de ${res.adminEmail}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.resettingPassword.set(false);
        this.toast.error(this.mapResetError(err));
      },
    });
  }

  // Backend devuelve mensajes de negocio ya en español y listos para mostrar
  // ("La empresa no existe.", "El usuario no existe.", mismatch, complejidad
  // de password vía Identity) en el mismo envelope {error} que el resto de la app.
  private mapResetError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'No se pudo restablecer la contraseña.';
  }
}
