import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { UsersService } from '../../../core/services/users';
import { TeamRole } from '../../../core/models/user.model';
import { generatePassword } from '../../../shared/password-generator';
import { ToastService } from '../../../shared/toast/toast.service';
import { ResetPasswordModal, ResetPasswordResult } from '../../../shared/reset-password-modal/reset-password-modal';

const ROLES: { value: TeamRole; label: string }[] = [
  { value: 'Admin', label: 'Administrador' },
  { value: 'Warehouse', label: 'Almacén' },
  { value: 'Assistant', label: 'Asistente' },
];

@Component({
  selector: 'app-team-form',
  imports: [ReactiveFormsModule, RouterLink, ResetPasswordModal],
  templateUrl: './team-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamForm {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  userId = this.route.snapshot.paramMap.get('id');
  isEditMode = !!this.userId;
  roles = ROLES;

  loading = signal(this.isEditMode);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);
  copied = signal(false);

  resetModalOpen = signal(false);
  resettingPassword = signal(false);

  form = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    userName: ['', Validators.required],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['Warehouse' as TeamRole, Validators.required],
  });

  constructor() {
    if (this.userId) {
      // email/userName/password no se pueden editar por API — se muestran
      // solo de lectura y se sacan de la validación.
      this.form.controls.email.disable();
      this.form.controls.userName.disable();
      this.form.controls.password.disable();
      this.form.controls.password.clearValidators();

      this.usersService.get(this.userId).subscribe({
        next: user => {
          this.form.patchValue({
            fullName: user.fullName,
            email: user.email,
            userName: user.userName,
            phone: user.phone ?? '',
            role: user.role as TeamRole,
          });
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo cargar el usuario.');
          this.loading.set(false);
        },
      });
    }
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  generate() {
    this.form.controls.password.setValue(generatePassword(8));
    this.showPassword.set(true);
    this.copied.set(false);
  }

  async copyPassword() {
    const value = this.form.controls.password.value;
    if (!value) return;

    await navigator.clipboard.writeText(value);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const request = this.isEditMode
      ? this.usersService.update(this.userId!, {
          fullName: value.fullName!,
          phone: value.phone || null,
          role: value.role!,
        })
      : this.usersService.create({
          fullName: value.fullName!,
          email: value.email!,
          userName: value.userName!,
          phone: value.phone || null,
          password: value.password!,
          role: value.role!,
        });

    request.subscribe({
      next: () => {
        this.toast.success(this.isEditMode ? 'Usuario actualizado.' : 'Usuario creado.');
        this.router.navigate(['/team']);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
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

  resetPassword(result: ResetPasswordResult) {
    if (!this.userId) return;

    this.resettingPassword.set(true);
    this.usersService.resetPassword(this.userId, result.password).subscribe({
      next: () => {
        this.resettingPassword.set(false);
        this.resetModalOpen.set(false);
        this.toast.success('Se restableció la contraseña del usuario.');
      },
      error: (err: HttpErrorResponse) => {
        this.resettingPassword.set(false);
        this.toast.error(this.mapError(err));
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error. Intenta nuevamente.';
  }
}
