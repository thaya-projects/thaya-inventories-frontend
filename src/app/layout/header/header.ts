import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

// TODO: solo cubre el menú de super_admin por ahora; sumar admin/warehouse/assistant
// cuando se implementen esos roles.
const PAGE_NAMES: Record<string, string> = {
  '/dashboard':             'Dashboard',
  '/empresas':              'Empresas',
  '/empresas/nueva':        'Nueva empresa',
  '/suscripciones/planes':  'Planes',
  '/suscripciones/activas': 'Suscripciones activas',
  '/suscripciones/pagos':   'Pagos de suscripciones',
  '/reportes':              'Reportes',
  '/configuracion':         'Configuración',
};

function formatDateEs(date: Date): string {
  return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  @Output() openSidebar = new EventEmitter<void>();

  private router = inject(Router);

  // TODO: reemplazar por AuthService real
  userName = 'Admin';

  private pathname = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  pageName = computed(() => PAGE_NAMES[this.pathname()] ?? 'THAYA');
  today = formatDateEs(new Date());

  getInitial(): string {
    return this.userName.charAt(0).toUpperCase();
  }
}
