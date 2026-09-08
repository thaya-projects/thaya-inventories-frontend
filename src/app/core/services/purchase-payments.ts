import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreatePurchasePaymentRequest,
  ListPurchasePaymentsResponse,
  PurchasePayment,
} from '../models/purchase-payment.model';

const baseUrl = (purchaseId: string) => `${environment.apiUrl}/purchases/${purchaseId}/payments`;

@Injectable({ providedIn: 'root' })
export class PurchasePaymentsService {
  private http = inject(HttpClient);

  list(purchaseId: string): Observable<PurchasePayment[]> {
    return this.http.get<ListPurchasePaymentsResponse>(baseUrl(purchaseId)).pipe(map(res => res.items));
  }

  create(purchaseId: string, body: CreatePurchasePaymentRequest): Observable<PurchasePayment> {
    return this.http.post<PurchasePayment>(baseUrl(purchaseId), body);
  }
}
