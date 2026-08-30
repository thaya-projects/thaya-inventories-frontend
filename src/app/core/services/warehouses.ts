import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateWarehouseRequest,
  ListWarehousesResponse,
  UpdateWarehouseRequest,
  Warehouse,
  WarehouseListFilters,
} from '../models/warehouse.model';

const BASE_URL = `${environment.apiUrl}/warehouses`;

@Injectable({ providedIn: 'root' })
export class WarehousesService {
  private http = inject(HttpClient);

  list(filters?: WarehouseListFilters): Observable<Warehouse[]> {
    let params = new HttpParams();
    if (filters?.isActive !== undefined) {
      params = params.set('isActive', filters.isActive);
    }

    return this.http.get<ListWarehousesResponse>(BASE_URL, { params }).pipe(map(res => res.items));
  }

  get(id: string): Observable<Warehouse> {
    return this.http.get<Warehouse>(`${BASE_URL}/${id}`);
  }

  create(body: CreateWarehouseRequest): Observable<Warehouse> {
    return this.http.post<Warehouse>(BASE_URL, body);
  }

  update(id: string, body: UpdateWarehouseRequest): Observable<Warehouse> {
    return this.http.put<Warehouse>(`${BASE_URL}/${id}`, body);
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
