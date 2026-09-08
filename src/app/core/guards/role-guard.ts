import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

// Factory: cada ruta declara qué roles pueden entrar, ej. canActivate: [roleGuard('Admin')].
// Complementa a authGuard (que solo exige sesión) — si el rol no está en la
// lista, redirige a /dashboard en vez de dejar cargar una pantalla que el
// backend igual va a rechazar con 403.
export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const role = auth.currentUser()?.role;
    if (role && allowedRoles.includes(role)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
}
