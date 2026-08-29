import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MarkPaidRequest, SubscriptionPayment, SubscriptionPaymentListFilters } from '../models/subscription-payment.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/subscription-payments`;

@Injectable({ providedIn: 'root' })
export class SubscriptionPaymentsService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: SubscriptionPaymentListFilters): Observable<PagedResult<SubscriptionPayment>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.companySubscriptionId) {
      params = params.set('companySubscriptionId', filters.companySubscriptionId);
    }
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    return this.http.get<PagedResult<SubscriptionPayment>>(BASE_URL, { params });
  }

  get(id: string): Observable<SubscriptionPayment> {
    return this.http.get<SubscriptionPayment>(`${BASE_URL}/${id}`);
  }

  // paidAt es opcional — si se omite, el backend usa la hora actual (UTC).
  // Nota: esto también activa la suscripción asociada del lado del backend
  // (status Active + extiende currentPeriodEnd), pero esta pantalla no la
  // refresca — si en algún momento se muestran juntas, hay que recargarla aparte.
  markPaid(id: string, paidAt?: string): Observable<SubscriptionPayment> {
    const body: MarkPaidRequest = paidAt ? { paidAt } : {};
    return this.http.patch<SubscriptionPayment>(`${BASE_URL}/${id}/mark-paid`, body);
  }
}
