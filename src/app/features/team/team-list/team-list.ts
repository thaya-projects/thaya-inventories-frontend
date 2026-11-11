import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { UsersService } from '../../../core/services/users';
import { TeamUser, ROLE_LABELS } from '../../../core/models/user.model';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'app-team-list',
  imports: [DataTable, RouterLink],
  templateUrl: './team-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamList {
  private usersService = inject(UsersService);
  private toast = inject(ToastService);

  users = signal<TeamUser[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  updatingId = signal<string | null>(null);

  roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

  private roleTpl = viewChild.required<TemplateRef<{ $implicit: TeamUser }>>('roleTpl');
  private activeTpl = viewChild.required<TemplateRef<{ $implicit: TeamUser }>>('activeTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: TeamUser }>>('actionsTpl');

  columns = computed<DataTableColumn<TeamUser>[]>(() => [
    { key: 'fullName', label: 'Nombre' },
    { key: 'email', label: 'Correo' },
    { key: 'role', label: 'Rol', cellTemplate: this.roleTpl() },
    { key: 'isActive', label: 'Estado', cellTemplate: this.activeTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.usersService.list().subscribe({
      next: users => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el equipo.');
        this.loading.set(false);
      },
    });
  }

  toggleActive(user: TeamUser) {
    this.updatingId.set(user.id);
    const action = user.isActive ? this.usersService.deactivate(user.id) : this.usersService.activate(user.id);

    action.subscribe({
      next: () => {
        this.updatingId.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.updatingId.set(null);
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
