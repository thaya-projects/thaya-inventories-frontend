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
  // Label del separador visual a pintar arriba de este ítem (ej. "Empresa") —
  // solo se setea en el primer ítem de un grupo, no es un acordeón.
  dividerBefore?: string;
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

// Menú del admin de empresa, filtrado por settings de la empresa y features
// del plan contratado (ver buildAdminNav). Claves faltantes = false.
//
// Rediseño "menú corto" (prompt UX Admin): el sidebar deja de ser un mapa del
// backend — catálogos (clientes, proveedores, categorías, unidades,
// almacenes, movimientos, métodos de pago) se navegan desde dentro de
// Ventas/Compras/Inventario/Caja, no como ítems hermanos acá. Por rol:
//   Admin: Inicio, Ventas, Compras, Inventario, Caja, Producción (si aplica),
//          Reportes, + grupo "Empresa" (Gastos, Equipo, Mi empresa).
//   Warehouse: Inicio, Inventario, Compras, Ventas, Producción (si aplica), Reportes.
//          Sin Caja, sin grupo Empresa.
//   Assistant: Inicio, Ventas, Caja, Reportes. Sin Compras/Inventario/Producción/Empresa.

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

    const isAdmin = role === 'Admin';
    const isWarehouse = role === 'Warehouse';
    const isAssistant = role === 'Assistant';

    // Assistant: solo Ventas + Caja — sin catálogo/compras/producción.
    const showInventory = features.inventory !== false && !isAssistant;
    const showPurchases = features.purchases !== false && !isAssistant;
    const showSales = features.sales !== false;
    // Warehouse no maneja plata — sin Caja en su menú (igual conserva acceso
    // por URL vía roleGuard, esto es solo navegación).
    const showCash = !isWarehouse;
    // Producción: solo Admin/Warehouse, y solo si el plan la incluye Y la
    // empresa tiene el módulo habilitado (si no, el backend rechaza todo con
    // 400 — ver production-orders-list).
    const showProduction = on(features.production) && on(settings.usesProduction) && (isAdmin || isWarehouse);

    // Caja sí desglosa Pagos/Métodos de pago como grupo — a diferencia de los
    // demás catálogos, son dos pantallas igual de importantes, no una
    // secundaria dentro de otra.
    const cashChildren: NavChild[] = [{ label: 'Pagos', route: '/cash/payments' }];
    if (isAdmin) cashChildren.push({ label: 'Métodos de pago', route: '/cash/methods' });

    // Orden: lo que genera plata primero (Ventas, Compras, Inventario, Caja),
    // Producción después. El resto de catálogos (clientes, proveedores,
    // categorías, unidades, almacenes, movimientos) se navegan desde dentro
    // de cada pantalla (ver toolbars de sales-orders-list/purchases-list/products-list).
    const items: NavItem[] = [{ label: 'Inicio', route: '/dashboard', icon: 'grid' }];
    if (showSales) items.push({ label: 'Ventas', route: '/sales', icon: 'cart' });
    if (showPurchases) items.push({ label: 'Compras', route: '/purchases', icon: 'inbox' });
    if (showInventory) items.push({ label: 'Inventario', route: '/inventory/products', icon: 'box' });
    if (showCash) items.push({ label: 'Caja', icon: 'wallet', children: cashChildren });
    if (showProduction) items.push({ label: 'Producción', route: '/production', icon: 'factory' });
    // Rentabilidad combina ventas/compras/gastos — mismos roles que ven esos módulos.
    items.push({ label: 'Reportes', route: '/reports/profit', icon: 'chart' });

    if (isAdmin) {
      items.push({ label: 'Gastos', route: '/expenses', icon: 'card', dividerBefore: 'Empresa' });
      items.push({ label: 'Equipo', route: '/team', icon: 'users' });
      items.push({ label: 'Mi empresa', route: '/company', icon: 'building' });
    }

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
