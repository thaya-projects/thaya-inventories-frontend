import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavIcon } from './nav-icon';

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
      { label: 'Todas las empresas', route: '/empresas' },
      { label: 'Nueva empresa', route: '/empresas/nueva' },
    ],
  },
  {
    label: 'Suscripciones',
    icon: 'card',
    children: [
      { label: 'Planes', route: '/suscripciones/planes' },
      { label: 'Suscripciones activas', route: '/suscripciones/activas' },
      { label: 'Pagos de suscripciones', route: '/suscripciones/pagos' },
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

  // Modo icon-only en desktop; no aplica a la instancia del drawer móvil.
  collapsed = signal(false);

  toggleCollapsed() {
    this.collapsed.update(v => !v);
  }

  // TODO: por ahora solo existe el menú de super_admin. Cuando se agreguen
  // los roles admin/warehouse/assistant, este pasa a ser un mapa por rol.
  navItems: NavItem[] = SUPER_ADMIN_NAV;

  private expandedGroups = signal<Set<string>>(new Set());

  isExpanded(label: string) {
    return this.expandedGroups().has(label);
  }

  toggleGroup(item: NavItem) {
    if (this.collapsed()) {
      this.collapsed.set(false);
    }
    this.expandedGroups.update(current => {
      const next = new Set(current);
      if (next.has(item.label)) {
        next.delete(item.label);
      } else {
        next.add(item.label);
      }
      return next;
    });
  }

  logout() {
    // Aquí tu lógica de cerrar sesión
    console.log('Cerrar sesión');
  }
}
