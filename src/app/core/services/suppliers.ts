import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ListSuppliersResponse, SaveSupplierRequest, Supplier, SupplierListFilters } from '../models/supplier.model';

const BASE_URL = `${environment.apiUrl}/suppliers`;

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private http = inject(HttpClient);

  list(filters?: SupplierListFilters): Observable<Supplier[]> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.isActive !== undefined) params = params.set('isActive', filters.isActive);

    return this.http.get<ListSuppliersResponse>(BASE_URL, { params }).pipe(map(res => res.items));
  }

  get(id: string): Observable<Supplier> {
    return this.http.get<Supplier>(`${BASE_URL}/${id}`);
  }

  create(body: SaveSupplierRequest): Observable<Supplier> {
    return this.http.post<Supplier>(BASE_URL, body);
  }

  update(id: string, body: SaveSupplierRequest): Observable<Supplier> {
    return this.http.put<Supplier>(`${BASE_URL}/${id}`, body);
  }

  activate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/deactivate`, null);
  }
}
