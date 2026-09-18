import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CompleteProductionOrderRequest,
  ProductionOrder,
  ProductionOrderListFilters,
  SaveProductionOrderRequest,
} from '../models/production-order.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/production-orders`;

@Injectable({ providedIn: 'root' })
export class ProductionOrdersService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: ProductionOrderListFilters): Observable<PagedResult<ProductionOrder>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.productId) params = params.set('productId', filters.productId);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

    return this.http.get<PagedResult<ProductionOrder>>(BASE_URL, { params });
  }

  get(id: string): Observable<ProductionOrder> {
    return this.http.get<ProductionOrder>(`${BASE_URL}/${id}`);
  }

  create(body: SaveProductionOrderRequest): Observable<ProductionOrder> {
    return this.http.post<ProductionOrder>(BASE_URL, body);
  }

  update(id: string, body: SaveProductionOrderRequest): Observable<ProductionOrder> {
    return this.http.put<ProductionOrder>(`${BASE_URL}/${id}`, body);
  }

  complete(id: string, body?: CompleteProductionOrderRequest): Observable<ProductionOrder> {
    return this.http.post<ProductionOrder>(`${BASE_URL}/${id}/complete`, body ?? {});
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${BASE_URL}/${id}/cancel`, null);
  }
}
