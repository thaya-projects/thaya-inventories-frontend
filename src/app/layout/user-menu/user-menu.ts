import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-user-menu',
  imports: [RouterLink],
  templateUrl: './user-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenu {
  private auth = inject(AuthService);
  private router = inject(Router);

  open = signal(false);
  userName = computed(() => this.auth.currentUser()?.fullName ?? 'Usuario');
  userEmail = computed(() => this.auth.currentUser()?.email ?? '');

  getInitial(): string {
    return this.userName().charAt(0).toUpperCase();
  }

  toggle() {
    this.open.update(v => !v);
  }

  close() {
    this.open.set(false);
  }

  logout() {
    this.close();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
