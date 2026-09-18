import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NavIcon } from './nav-icon';
import { AuthService } from '../../core/services/auth';
import { CompanyContextService } from '../../core/services/company-context';

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
// empresa, por eso va fijo acá.
const SUPER_ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: 'grid' },
  { label: 'Empresas', route: '/companies', icon: 'building' },
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

// Menú del admin de empresa (Fase 2), filtrado por settings de la empresa y
// features del plan contratado (ver buildAdminNav). Claves faltantes = false.
// TODO: warehouse/assistant ven menos ítems que admin — falta confirmar qué
// catálogos exactos pierden (por ahora solo se gatea Equipo/Mi empresa por rol).

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
  private companyContext = inject(CompanyContextService);

  // Modo icon-only en desktop; no aplica a la instancia del drawer móvil.
  collapsed = signal(false);

  toggleCollapsed() {
    this.collapsed.update(v => !v);
  }

  navItems = computed<NavItem[]>(() => {
    const role = this.auth.currentUser()?.role;
    return role === 'SuperAdmin' ? SUPER_ADMIN_NAV : this.buildAdminNav(role);
  });

  // features/settings son objetos libres del backend (sin schema fijo): toda
  // clave ausente se trata como false, nunca como error.
  private buildAdminNav(role: string | undefined): NavItem[] {
    const settings = this.companyContext.company()?.settings ?? {};
    const features = this.companyContext.subscription()?.features ?? {};
    const on = (v: unknown) => v === true;

    const showInventory = features.inventory !== false;
    const showPurchases = features.purchases !== false;
    const showSales = features.sales !== false;
    const showWarehouses = on(features.multiWarehouse) && on(settings.usesMultiWarehouse);
    const isAdmin = role === 'Admin';
    // Producción: solo Admin/Warehouse, y solo si el plan la incluye Y la
    // empresa tiene el módulo habilitado (si no, el backend rechaza todo con
    // 400 — ver production-orders-list).
    const showProduction = on(features.production) && on(settings.usesProduction) && (isAdmin || role === 'Warehouse');

    const inventoryChildren: NavChild[] = [
      { label: 'Productos', route: '/inventory/products' },
      { label: 'Movimientos', route: '/inventory/movements' },
      { label: 'Categorías', route: '/inventory/categories' },
      { label: 'Unidades', route: '/inventory/units' },
    ];
    if (showWarehouses) {
      inventoryChildren.push({ label: 'Almacenes', route: '/inventory/warehouses' });
    }

    const purchasesChildren: NavChild[] = [
      { label: 'Órdenes', route: '/purchases' },
      { label: 'Proveedores', route: '/purchases/suppliers' },
    ];

    const salesChildren: NavChild[] = [
      { label: 'Órdenes', route: '/sales' },
      { label: 'Clientes', route: '/sales/customers' },
    ];

    const cashChildren: NavChild[] = [{ label: 'Pagos', route: '/cash/payments' }];
    if (isAdmin) {
      cashChildren.push({ label: 'Métodos de pago', route: '/cash/methods' });
    }

    const items: NavItem[] = [{ label: 'Dashboard', route: '/dashboard', icon: 'grid' }];
    if (showInventory) items.push({ label: 'Inventario', icon: 'box', children: inventoryChildren });
    if (showPurchases) items.push({ label: 'Compras', icon: 'inbox', children: purchasesChildren });
    if (showProduction) items.push({ label: 'Producción', route: '/production', icon: 'factory' });
    if (showSales) items.push({ label: 'Ventas', icon: 'cart', children: salesChildren });
    items.push({ label: 'Caja', icon: 'wallet', children: cashChildren });
    if (isAdmin) items.push({ label: 'Gastos', route: '/expenses', icon: 'card' });
    if (isAdmin) items.push({ label: 'Equipo', route: '/team', icon: 'users' });
    if (isAdmin) items.push({ label: 'Mi empresa', route: '/company', icon: 'building' });
    items.push({ label: 'Notificaciones', route: '/notifications', icon: 'bell' });
    return items;
  }

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
