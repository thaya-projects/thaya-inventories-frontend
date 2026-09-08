import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { ResetPasswordModal, ResetPasswordResult } from '../../../shared/reset-password-modal/reset-password-modal';
import { CompaniesService } from '../../../core/services/companies';
import { Company } from '../../../core/models/company.model';
import { subscriptionStatusBadgeClass } from '../../../shared/subscription-status';
import { ToastService } from '../../../shared/toast/toast.service';

// Recibe la empresa directo del row de companies-list (GET /platform/companies
// y GET /platform/companies/{id} comparten el mismo shape Company) — no hace
// falta un segundo fetch solo para pintar el modal.
@Component({
  selector: 'app-company-detail-modal',
  imports: [Modal, DatePipe, ResetPasswordModal],
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
  updating = signal(false);
  errorMessage = signal<string | null>(null);

  resetModalOpen = signal(false);
  resettingPassword = signal(false);

  statusBadgeClass = subscriptionStatusBadgeClass;

  ngOnInit(): void {
    this.current.set(this.company());
  }

  toggleActive() {
    const current = this.current();
    if (!current) return;

    this.updating.set(true);
    this.companiesService.setActive(current.id, !current.isActive).subscribe({
      next: updated => {
        this.current.set(updated);
        this.updating.set(false);
        this.updated.emit(updated);
      },
      error: () => {
        this.errorMessage.set('No se pudo actualizar el estado de la empresa.');
        this.updating.set(false);
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
