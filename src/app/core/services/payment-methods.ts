import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreatePaymentMethodRequest,
  ListPaymentMethodsResponse,
  PaymentMethod,
  PaymentMethodListFilters,
  UpdatePaymentMethodRequest,
} from '../models/payment-method.model';

const BASE_URL = `${environment.apiUrl}/payment-methods`;

@Injectable({ providedIn: 'root' })
export class PaymentMethodsService {
  private http = inject(HttpClient);

  list(filters?: PaymentMethodListFilters): Observable<PaymentMethod[]> {
    let params = new HttpParams();
    if (filters?.isActive !== undefined) params = params.set('isActive', filters.isActive);

    return this.http.get<ListPaymentMethodsResponse>(BASE_URL, { params }).pipe(map(res => res.items));
  }

  get(id: string): Observable<PaymentMethod> {
    return this.http.get<PaymentMethod>(`${BASE_URL}/${id}`);
  }

  create(body: CreatePaymentMethodRequest): Observable<PaymentMethod> {
    return this.http.post<PaymentMethod>(BASE_URL, body);
  }

  update(id: string, body: UpdatePaymentMethodRequest): Observable<PaymentMethod> {
    return this.http.put<PaymentMethod>(`${BASE_URL}/${id}`, body);
  }

  activate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/deactivate`, null);
  }

  setDefault(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/set-default`, null);
  }
}
