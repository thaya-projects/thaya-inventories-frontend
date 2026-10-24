import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, catchError, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth';
import { environment } from '../../../environments/environment';

// login/refresh no pasan por el ciclo 401→refresh→reintento (login no tiene
// token todavía, refresh directamente no lo exige) y logout se excluye a
// propósito — no tiene sentido refrescar la sesión justo cuando se está
// cerrando, y evita una carrera rara si el access vence justo al hacer logout.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

// Estado a nivel de módulo: un interceptor funcional no tiene instancia propia
// (se re-ejecuta por request), así que la cola de "un solo refresh a la vez"
// vive acá — patrón estándar para este caso en Angular. `refreshTokenSubject`
// se recrea en cada ciclo nuevo: si el refresh falla, se propaga el error a
// TODOS los requests que estaban esperando en cola (no solo al que disparó el
// refresh), vía Subject.error().
let isRefreshing = false;
let refreshTokenSubject = new Subject<string>();

function withAuth(req: HttpRequest<unknown>, token: string) {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Nunca adjuntar el token (ni disparar el ciclo de refresh) fuera de nuestro
  // propio backend — evita que se filtre a un tercero si el día de mañana se
  // agrega una llamada externa (mapas, analytics, etc.).
  const isOwnApi = req.url.startsWith(environment.apiUrl);
  const token = auth.accessToken;
  const authedReq = token && isOwnApi ? withAuth(req, token) : req;
  const isAuthEndpoint = AUTH_ENDPOINTS.some(path => req.url.includes(path));

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (!isOwnApi || isAuthEndpoint || !(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }

      if (isRefreshing) {
        // Ya hay un refresh en curso: encolar y reintentar cuando llegue el token nuevo.
        return refreshTokenSubject.pipe(
          take(1),
          switchMap(newToken => next(withAuth(req, newToken))),
        );
      }

      isRefreshing = true;
      refreshTokenSubject = new Subject<string>();

      return auth.refresh().pipe(
        switchMap(() => {
          isRefreshing = false;
          const newToken = auth.accessToken!;
          refreshTokenSubject.next(newToken);
          return next(withAuth(req, newToken));
        }),
        catchError((refreshErr: unknown) => {
          isRefreshing = false;
          refreshTokenSubject.error(refreshErr);
          // 401 del refresh es terminal — sin excepciones, no se reintenta.
          auth.clearSession();
          router.navigate(['/login']);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
