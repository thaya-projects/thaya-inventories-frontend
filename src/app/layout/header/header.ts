import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { NotificationBell } from '../notification-bell/notification-bell';
import { UserMenu } from '../user-menu/user-menu';

// TODO: warehouse/assistant ven menos ítems que admin — falta esa variante.
const PAGE_NAMES: Record<string, string> = {
  '/dashboard':                'Dashboard',
  '/companies':                'Empresas',
  '/subscriptions/plans':      'Planes',
  '/subscriptions/active':     'Suscripciones activas',
  '/subscriptions/payments':   'Pagos de suscripciones',
  '/reportes':                 'Reportes',
  '/configuracion':            'Configuración',
  '/company':                  'Mi empresa',
  '/team':                     'Equipo',
  '/team/new':                 'Nuevo usuario',
  '/inventory/products':       'Productos',
  '/inventory/categories':     'Categorías',
  '/inventory/units':          'Unidades',
  '/inventory/warehouses':     'Almacenes',
  '/inventory/warehouses/new': 'Nuevo almacén',
  '/inventory/movements':          'Movimientos',
  '/purchases':                'Compras',
  '/purchases/suppliers':      'Proveedores',
  '/sales':                    'Ventas',
  '/sales/customers':          'Clientes',
  '/cash/payments':            'Pagos',
  '/cash/methods':             'Métodos de pago',
  '/expenses':                 'Gastos',
  '/notifications':            'Notificaciones',
  '/profile':                  'Mi perfil',
};

function formatDateEs(date: Date): string {
  return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

@Component({
  selector: 'app-header',
  imports: [NotificationBell, UserMenu],
  templateUrl: './header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  @Output() openSidebar = new EventEmitter<void>();

  private router = inject(Router);
  private auth = inject(AuthService);

  // Campana: solo roles de empresa, no SuperAdmin (mismo shell para ambos).
  showNotificationBell = computed(() => this.auth.currentUser()?.role !== 'SuperAdmin');

  private pathname = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  pageName = computed(() => {
    const path = this.pathname();
    if (PAGE_NAMES[path]) return PAGE_NAMES[path];
    if (path.startsWith('/team/')) return 'Editar usuario';
    if (path.startsWith('/inventory/warehouses/')) return 'Editar almacén';
    if (path.endsWith('/kardex')) return 'Kardex';
    if (path.startsWith('/purchases/')) return 'Detalle de compra';
    if (path.startsWith('/sales/')) return 'Detalle de venta';
    if (path.startsWith('/cash/payments/')) return 'Detalle de pago';
    if (path.startsWith('/expenses/')) return 'Detalle de gasto';
    return 'THAYA';
  });
  today = formatDateEs(new Date());
}
