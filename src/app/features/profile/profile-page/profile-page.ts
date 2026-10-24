import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth';

const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: 'Super administrador',
  Admin: 'Administrador',
  Warehouse: 'Almacén',
  Assistant: 'Asistente',
};

// Sin endpoint propio todavía (no hay GET /api/users/me) — se muestra lo que
// ya tenemos en sesión desde el login. Sin edición: no hay PUT confirmado
// para el propio usuario.
@Component({
  selector: 'app-profile-page',
  templateUrl: './profile-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private auth = inject(AuthService);

  user = this.auth.currentUser;
  roleLabel = computed(() => {
    const role = this.user()?.role;
    return role ? (ROLE_LABELS[role] ?? role) : '—';
  });

  getInitial(): string {
    return (this.user()?.fullName ?? 'Usuario').charAt(0).toUpperCase();
  }
}
