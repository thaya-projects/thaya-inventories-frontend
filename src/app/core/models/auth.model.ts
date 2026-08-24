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

export interface CurrentUser {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

export interface ApiErrorBody {
  error: string;
}
