import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CurrentUser, LoginRequest, LoginResponse, RefreshRequest, RefreshResponse } from '../models/auth.model';

const STORAGE_KEY = 'thaya.auth';

interface StoredSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: CurrentUser;
}

// Persistencia propia (sin librería): "recordarme" decide si la sesión va a
// localStorage (sobrevive cerrar el navegador) o sessionStorage (solo la pestaña).
// El backend no setea cookies — el token viaja siempre por header Authorization,
// así que no hay ninguna ventaja real en usar cookies acá.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private accessTokenSig = signal<string | null>(null);
  private currentUserSig = signal<CurrentUser | null>(null);

  readonly currentUser = this.currentUserSig.asReadonly();
  readonly isAuthenticated = computed(() => !!this.accessTokenSig());

  constructor() {
    this.hydrateFromStorage();
  }

  get accessToken(): string | null {
    return this.accessTokenSig();
  }

  login(identifier: string, password: string, remember: boolean): Observable<LoginResponse> {
    const body: LoginRequest = {
      identifier,
      password,
      clientType: 'Web',
      deviceId: null,
      deviceInfo: null,
    };

    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, body).pipe(
      tap(res => this.setSession(res, remember ? localStorage : sessionStorage)),
    );
  }

  // POST /api/auth/refresh — sin Authorization header (el backend no lo exige
  // acá). clientType siempre 'Web', igual que en login. La sesión se
  // reescribe en el MISMO storage en el que ya vivía (no depende de
  // "recordarme" — eso solo aplica en el login inicial).
  //
  // ⚠️ 401 acá es terminal: nunca "recuperable" (token vencido, ya usado,
  // revocado, o la empresa/suscripción dejaron de estar activas — mismo
  // comportamiento que un login fallido). El caller (el interceptor) es
  // responsable de limpiar la sesión y mandar a /login sin reintentar.
  refresh(): Observable<RefreshResponse> {
    const refreshToken = this.readStoredSession()?.refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('No hay una sesión para refrescar.'));
    }

    const body: RefreshRequest = { refreshToken, clientType: 'Web', deviceId: null, deviceInfo: null };
    const storage = this.getActiveStorage();

    return this.http
      .post<RefreshResponse>(`${environment.apiUrl}/auth/refresh`, body)
      .pipe(tap(res => this.setSession(res, storage)));
  }

  // El logout se siente instantáneo del lado del cliente: limpiamos storage y
  // signals ya mismo. La llamada al backend (que revoca el refreshToken) va en
  // paralelo — si falla por red o el token ya venció, no bloqueamos nada: el
  // usuario ya quedó deslogueado acá, que es lo único que importa en el cliente.
  // POST /api/auth/logout SÍ exige Authorization: Bearer <accessToken> — lo
  // agrega el interceptor solo, mientras el token siga en el signal (por eso
  // se dispara ANTES de limpiar la sesión local). Response 204 sin body.
  logout(): void {
    const refreshToken = this.readStoredSession()?.refreshToken ?? null;

    if (refreshToken) {
      this.http.post<void>(`${environment.apiUrl}/auth/logout`, { refreshToken }).subscribe({
        error: () => { /* no-op: el logout local ya se hizo */ },
      });
    }

    this.clearSession();
  }

  // Pública: el interceptor la llama cuando un refresh falla con 401 (sesión
  // terminada sin vuelta atrás) para descartar todo de una.
  clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    this.accessTokenSig.set(null);
    this.currentUserSig.set(null);
  }

  private setSession(res: LoginResponse, storage: Storage): void {
    const session: StoredSession = {
      accessToken: res.accessToken,
      accessTokenExpiresAt: res.accessTokenExpiresAt,
      refreshToken: res.refreshToken,
      refreshTokenExpiresAt: res.refreshTokenExpiresAt,
      user: {
        userId: res.userId,
        fullName: res.fullName,
        email: res.email,
        role: res.role,
      },
    };

    // Si cambió la elección de "recordarme" respecto al login anterior, no
    // dejar una copia vieja de la sesión en el otro storage.
    const otherStorage = storage === localStorage ? sessionStorage : localStorage;
    otherStorage.removeItem(STORAGE_KEY);
    storage.setItem(STORAGE_KEY, JSON.stringify(session));

    this.accessTokenSig.set(session.accessToken);
    this.currentUserSig.set(session.user);
  }

  private hydrateFromStorage(): void {
    const session = this.readStoredSession();
    if (!session) return;

    if (new Date(session.accessTokenExpiresAt).getTime() <= Date.now()) {
      // No se intenta refrescar acá en el arranque — el ciclo 401→refresh del
      // interceptor ya cubre esto en cuanto se dispare el primer request
      // autenticado; hacerlo acá además metería una carrera con authGuard
      // (que lee isAuthenticated() de forma síncrona).
      this.clearSession();
      return;
    }

    this.accessTokenSig.set(session.accessToken);
    this.currentUserSig.set(session.user);
  }

  private getActiveStorage(): Storage {
    return sessionStorage.getItem(STORAGE_KEY) ? sessionStorage : localStorage;
  }

  private readStoredSession(): StoredSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
