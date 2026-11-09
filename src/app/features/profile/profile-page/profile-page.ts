import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import { PhoneVerificationService, PhoneVerificationStatus } from '../../../core/services/phone-verification';
import { ROLE_LABELS } from '../../../core/models/user.model';
import { ToastService } from '../../../shared/toast/toast.service';

// Datos de sesión + verificación del teléfono por WhatsApp. El teléfono en sí
// lo edita un Admin desde Equipo (no hay PUT para el propio usuario).
@Component({
  selector: 'app-profile-page',
  imports: [FormsModule],
  templateUrl: './profile-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private auth = inject(AuthService);
  private phoneService = inject(PhoneVerificationService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  user = this.auth.currentUser;
  roleLabel = computed(() => {
    const role = this.user()?.role;
    return role ? (ROLE_LABELS[role] ?? role) : '—';
  });

  phoneStatus = signal<PhoneVerificationStatus | null>(null);
  phoneLoading = signal(true);
  codeSentTo = signal<string | null>(null);
  code = signal('');
  sending = signal(false);
  confirming = signal(false);
  phoneError = signal<string | null>(null);
  resendIn = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    this.phoneService.status().subscribe({
      next: status => {
        this.phoneStatus.set(status);
        this.phoneLoading.set(false);
      },
      error: () => this.phoneLoading.set(false),
    });
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
  }

  getInitial(): string {
    return (this.user()?.fullName ?? 'Usuario').charAt(0).toUpperCase();
  }

  sendCode() {
    this.sending.set(true);
    this.phoneError.set(null);
    this.phoneService.send().subscribe({
      next: res => {
        this.sending.set(false);
        this.codeSentTo.set(res.maskedPhone);
        this.code.set('');
        this.startCountdown(res.resendAfterSeconds);
        this.toast.success(`Te enviamos un código por WhatsApp al ${res.maskedPhone}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.phoneError.set(this.mapError(err, 'No se pudo enviar el código.'));
      },
    });
  }

  onCodeInput(value: string) {
    this.code.set(value.replace(/\D/g, '').slice(0, 6));
  }

  confirmCode() {
    if (this.code().length !== 6) {
      this.phoneError.set('El código tiene 6 dígitos.');
      return;
    }
    this.confirming.set(true);
    this.phoneError.set(null);
    this.phoneService.confirm(this.code()).subscribe({
      next: res => {
        this.confirming.set(false);
        this.phoneStatus.set({ phone: res.phone, phoneVerified: res.phoneVerified });
        this.codeSentTo.set(null);
        clearInterval(this.timer);
        this.toast.success('Teléfono verificado.');
      },
      error: (err: HttpErrorResponse) => {
        this.confirming.set(false);
        this.phoneError.set(this.mapError(err, 'No se pudo verificar el código.'));
      },
    });
  }

  private startCountdown(seconds: number) {
    clearInterval(this.timer);
    this.resendIn.set(seconds);
    this.timer = setInterval(() => {
      const next = this.resendIn() - 1;
      this.resendIn.set(Math.max(0, next));
      if (next <= 0) clearInterval(this.timer);
    }, 1000);
  }

  private mapError(err: HttpErrorResponse, fallback: string): string {
    return typeof err.error?.error === 'string' ? err.error.error : fallback;
  }
}
