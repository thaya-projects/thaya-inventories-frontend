import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AssignSubscriptionRequest,
  CompanySubscription,
  CompanySubscriptionListFilters,
  UpdateSubscriptionRequest,
} from '../models/company-subscription.model';
import { RegisterPaymentRequest, SubscriptionPayment } from '../models/subscription-payment.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/company-subscriptions`;

@Injectable({ providedIn: 'root' })
export class CompanySubscriptionsService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: CompanySubscriptionListFilters): Observable<PagedResult<CompanySubscription>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.companyId) {
      params = params.set('companyId', filters.companyId);
    }
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    return this.http.get<PagedResult<CompanySubscription>>(BASE_URL, { params });
  }

  get(id: string): Observable<CompanySubscription> {
    return this.http.get<CompanySubscription>(`${BASE_URL}/${id}`);
  }

  // Bajo nivel: normalmente no hace falta, POST /platform/companies ya crea
  // la suscripción trial junto con la empresa.
  assign(payload: AssignSubscriptionRequest): Observable<CompanySubscription> {
    return this.http.post<CompanySubscription>(BASE_URL, payload);
  }

  update(id: string, payload: UpdateSubscriptionRequest): Observable<CompanySubscription> {
    return this.http.put<CompanySubscription>(`${BASE_URL}/${id}`, payload);
  }

  extendTrial(id: string, newTrialEndsAt: string): Observable<void> {
    return this.http.post<void>(`${BASE_URL}/${id}/extend-trial`, { newTrialEndsAt });
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${BASE_URL}/${id}/cancel`, null);
  }

  // Deja el pago en estado Pending — para marcarlo pagado de verdad, ver
  // SubscriptionPaymentsService.markPaid().
  registerPayment(id: string, payload: RegisterPaymentRequest): Observable<SubscriptionPayment> {
    return this.http.post<SubscriptionPayment>(`${BASE_URL}/${id}/payments`, payload);
  }
}
