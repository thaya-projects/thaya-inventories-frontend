import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdjustMovementRequest,
  CreateMovementRequest,
  InventoryMovement,
  MovementListFilters,
} from '../models/inventory-movement.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/inventory-movements`;

@Injectable({ providedIn: 'root' })
export class InventoryMovementsService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: MovementListFilters): Observable<PagedResult<InventoryMovement>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.productId) params = params.set('productId', filters.productId);
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.movementType) params = params.set('movementType', filters.movementType);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

    return this.http.get<PagedResult<InventoryMovement>>(BASE_URL, { params });
  }

  get(id: string): Observable<InventoryMovement> {
    return this.http.get<InventoryMovement>(`${BASE_URL}/${id}`);
  }

  create(body: CreateMovementRequest): Observable<InventoryMovement> {
    return this.http.post<InventoryMovement>(BASE_URL, body);
  }

  adjust(body: AdjustMovementRequest): Observable<InventoryMovement> {
    return this.http.post<InventoryMovement>(`${BASE_URL}/adjustment`, body);
  }
}
