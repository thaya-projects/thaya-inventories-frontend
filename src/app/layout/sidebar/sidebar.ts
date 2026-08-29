import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NavIcon } from './nav-icon';
import { AuthService } from '../../core/services/auth';

interface NavChild {
  label: string;
  route: string;
}

interface NavItem {
  label: string;
  icon: string;
  route?: string;
  children?: NavChild[];
}

// Menú del super_admin (plataforma). No depende de plan/suscripción de ninguna
// empresa, por eso va fijo aquí. Los menús de admin/warehouse/assistant se
// agregarán después y vendrán filtrados por un endpoint según lo habilitado
// en el plan de cada empresa.
const SUPER_ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: 'grid' },
  {
    label: 'Empresas',
    icon: 'building',
    children: [
      { label: 'Todas las empresas', route: '/companies' },
      { label: 'Nueva empresa', route: '/companies/new' },
    ],
  },
  {
    label: 'Suscripciones',
    icon: 'card',
    children: [
      { label: 'Planes', route: '/subscriptions/plans' },
      { label: 'Suscripciones activas', route: '/subscriptions/active' },
      { label: 'Pagos de suscripciones', route: '/subscriptions/payments' },
    ],
  },
  { label: 'Reportes', route: '/reportes', icon: 'chart' },
  { label: 'Configuración', route: '/configuracion', icon: 'settings' },
];

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule, NavIcon],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  @Input() showClose = false;
  @Output() closeSidebar = new EventEmitter<void>();

  private auth = inject(AuthService);
  private router = inject(Router);

  // Modo icon-only en desktop; no aplica a la instancia del drawer móvil.
  collapsed = signal(false);

  toggleCollapsed() {
    this.collapsed.update(v => !v);
  }

  // TODO: por ahora solo existe el menú de super_admin. Cuando se agreguen
  // los roles admin/warehouse/assistant, este pasa a ser un mapa por rol.
  navItems: NavItem[] = SUPER_ADMIN_NAV;

  // Acordeón: un solo grupo abierto a la vez, para que la lista no ocupe todo el sidebar.
  private expandedGroup = signal<string | null>(null);

  isExpanded(label: string) {
    return this.expandedGroup() === label;
  }

  toggleGroup(item: NavItem) {
    if (this.collapsed()) {
      this.collapsed.set(false);
    }
    this.expandedGroup.update(current => (current === item.label ? null : item.label));
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
