import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateSalesOrderPaymentRequest,
  ListSalesOrderPaymentsResponse,
  SalesOrderPayment,
} from '../models/sales-order-payment.model';

const baseUrl = (orderId: string) => `${environment.apiUrl}/sales-orders/${orderId}/payments`;

@Injectable({ providedIn: 'root' })
export class SalesOrderPaymentsService {
  private http = inject(HttpClient);

  list(orderId: string): Observable<SalesOrderPayment[]> {
    return this.http.get<ListSalesOrderPaymentsResponse>(baseUrl(orderId)).pipe(map(res => res.items));
  }

  create(orderId: string, body: CreateSalesOrderPaymentRequest): Observable<SalesOrderPayment> {
    return this.http.post<SalesOrderPayment>(baseUrl(orderId), body);
  }
}
