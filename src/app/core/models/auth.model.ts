export interface LoginRequest {
  identifier: string;
  password: string;
  clientType: 'Web';
  deviceId: string | null;
  deviceInfo: string | null;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

// POST /api/auth/refresh — no requiere Authorization header. clientType debe
// ser el mismo que se mandó en login; deviceId/deviceInfo son opcionales (si
// se omiten, el backend reusa los que ya tenía guardados el token viejo).
export interface RefreshRequest {
  refreshToken: string;
  clientType: 'Web';
  deviceId: string | null;
  deviceInfo: string | null;
}

// Mismo shape exacto que LoginResponse — pero ⚠️ el refreshToken que devuelve
// es DISTINTO al que se mandó (rotación real): hay que guardar el nuevo y
// descartar el viejo, que queda inválido de inmediato.
export type RefreshResponse = LoginResponse;

export interface CurrentUser {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

export interface ApiErrorBody {
  error: string;
}
