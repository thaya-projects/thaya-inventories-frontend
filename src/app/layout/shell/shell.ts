import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { ToastContainer } from '../../shared/toast/toast-container';
import { AuthService } from '../../core/services/auth';
import { CompanyContextService } from '../../core/services/company-context';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Header, ToastContainer],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private auth = inject(AuthService);
  private companyContext = inject(CompanyContextService);

  drawerOpen = signal(false);

  constructor() {
    // GET /api/company y /api/company/subscription son solo para la empresa
    // del usuario logueado — el SuperAdmin no tiene una "empresa propia".
    if (this.auth.currentUser()?.role !== 'SuperAdmin') {
      this.companyContext.load();
    }
  }

  openSidebar()  { this.drawerOpen.set(true); }
  closeSidebar() { this.drawerOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { this.drawerOpen.set(false); }
}
