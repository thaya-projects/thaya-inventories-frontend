import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MarkPaymentPaidRequest, Payment, PaymentListFilters } from '../models/payment.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/payments`;

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: PaymentListFilters): Observable<PagedResult<Payment>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.sourceType) params = params.set('sourceType', filters.sourceType);
    if (filters?.sourceId) params = params.set('sourceId', filters.sourceId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

    return this.http.get<PagedResult<Payment>>(BASE_URL, { params });
  }

  get(id: string): Observable<Payment> {
    return this.http.get<Payment>(`${BASE_URL}/${id}`);
  }

  markPaid(id: string, body: MarkPaymentPaidRequest): Observable<Payment> {
    return this.http.patch<Payment>(`${BASE_URL}/${id}/mark-paid`, body);
  }

  cancel(id: string): Observable<Payment> {
    return this.http.patch<Payment>(`${BASE_URL}/${id}/cancel`, null);
  }

  // multipart/form-data, campo "File" — mismo patrón que imágenes de producto.
  uploadProof(id: string, file: File): Observable<Payment> {
    const form = new FormData();
    form.append('File', file);
    return this.http.post<Payment>(`${BASE_URL}/${id}/upload-proof`, form);
  }
}
