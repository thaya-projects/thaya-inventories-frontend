import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CurrentUser, LoginRequest, LoginResponse } from '../models/auth.model';

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
      tap(res => this.setSession(res, remember)),
    );
  }

  // El logout se siente instantáneo del lado del cliente: limpiamos storage y
  // signals ya mismo. La llamada al backend (que revoca el refreshToken) va en
  // paralelo — si falla por red o el token ya venció, no bloqueamos nada: el
  // usuario ya quedó deslogueado acá, que es lo único que importa en el cliente.
  logout(): void {
    const refreshToken = this.readStoredSession()?.refreshToken ?? null;

    if (refreshToken) {
      this.http.post<void>(`${environment.apiUrl}/auth/logout`, { refreshToken }).subscribe({
        error: () => { /* no-op: el logout local ya se hizo */ },
      });
    }

    this.clearLocalSession();
  }

  private setSession(res: LoginResponse, remember: boolean): void {
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
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem(STORAGE_KEY);
    storage.setItem(STORAGE_KEY, JSON.stringify(session));

    this.accessTokenSig.set(session.accessToken);
    this.currentUserSig.set(session.user);
  }

  private hydrateFromStorage(): void {
    const session = this.readStoredSession();
    if (!session) return;

    if (new Date(session.accessTokenExpiresAt).getTime() <= Date.now()) {
      // TODO: usar session.refreshToken contra POST /api/auth/refresh en vez de
      // cerrar la sesión directamente. Todavía no está integrado ese endpoint.
      this.clearLocalSession();
      return;
    }

    this.accessTokenSig.set(session.accessToken);
    this.currentUserSig.set(session.user);
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

  private clearLocalSession(): void {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    this.accessTokenSig.set(null);
    this.currentUserSig.set(null);
  }
}
