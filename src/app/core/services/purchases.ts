import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LastPurchaseCost, Purchase, PurchaseListFilters, SavePurchaseRequest } from '../models/purchase.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/purchases`;

@Injectable({ providedIn: 'root' })
export class PurchasesService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: PurchaseListFilters): Observable<PagedResult<Purchase>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.supplierId) params = params.set('supplierId', filters.supplierId);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

    return this.http.get<PagedResult<Purchase>>(BASE_URL, { params });
  }

  lastCost(productId: string, supplierId?: string | null): Observable<LastPurchaseCost> {
    let params = new HttpParams().set('productId', productId);
    if (supplierId) params = params.set('supplierId', supplierId);
    return this.http.get<LastPurchaseCost>(`${BASE_URL}/last-cost`, { params });
  }

  get(id: string): Observable<Purchase> {
    return this.http.get<Purchase>(`${BASE_URL}/${id}`);
  }

  create(body: SavePurchaseRequest): Observable<Purchase> {
    return this.http.post<Purchase>(BASE_URL, body);
  }

  update(id: string, body: SavePurchaseRequest): Observable<Purchase> {
    return this.http.put<Purchase>(`${BASE_URL}/${id}`, body);
  }

  receive(id: string): Observable<Purchase> {
    return this.http.post<Purchase>(`${BASE_URL}/${id}/receive`, null);
  }

  cancel(id: string): Observable<Purchase> {
    return this.http.post<Purchase>(`${BASE_URL}/${id}/cancel`, null);
  }
}
