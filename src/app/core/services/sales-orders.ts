import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SalesOrder, SalesOrderListFilters, SaveSalesOrderRequest } from '../models/sales-order.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/sales-orders`;

@Injectable({ providedIn: 'root' })
export class SalesOrdersService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: SalesOrderListFilters): Observable<PagedResult<SalesOrder>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.customerId) params = params.set('customerId', filters.customerId);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

    return this.http.get<PagedResult<SalesOrder>>(BASE_URL, { params });
  }

  get(id: string): Observable<SalesOrder> {
    return this.http.get<SalesOrder>(`${BASE_URL}/${id}`);
  }

  create(body: SaveSalesOrderRequest): Observable<SalesOrder> {
    return this.http.post<SalesOrder>(BASE_URL, body);
  }

  update(id: string, body: SaveSalesOrderRequest): Observable<SalesOrder> {
    return this.http.put<SalesOrder>(`${BASE_URL}/${id}`, body);
  }

  dispatch(id: string): Observable<SalesOrder> {
    return this.http.post<SalesOrder>(`${BASE_URL}/${id}/dispatch`, null);
  }

  cancel(id: string): Observable<SalesOrder> {
    return this.http.post<SalesOrder>(`${BASE_URL}/${id}/cancel`, null);
  }
}
