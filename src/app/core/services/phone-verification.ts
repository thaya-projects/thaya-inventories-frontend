import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// /api/auth/phone-verification — siempre sobre el usuario del token.
export interface PhoneVerificationStatus {
  phone: string | null;
  phoneVerified: boolean;
}

export interface SendPhoneVerificationResponse {
  maskedPhone: string;
  expiresAt: string;
  resendAfterSeconds: number;
}

export interface ConfirmPhoneVerificationResponse {
  phoneVerified: boolean;
  phone: string;
}

const BASE_URL = `${environment.apiUrl}/auth/phone-verification`;

@Injectable({ providedIn: 'root' })
export class PhoneVerificationService {
  private http = inject(HttpClient);

  status(): Observable<PhoneVerificationStatus> {
    return this.http.get<PhoneVerificationStatus>(BASE_URL);
  }

  // Envía un código de 6 dígitos por WhatsApp (vence a los 10 minutos).
  send(): Observable<SendPhoneVerificationResponse> {
    return this.http.post<SendPhoneVerificationResponse>(`${BASE_URL}/send`, null);
  }

  confirm(code: string): Observable<ConfirmPhoneVerificationResponse> {
    return this.http.post<ConfirmPhoneVerificationResponse>(`${BASE_URL}/confirm`, { code });
  }
}
