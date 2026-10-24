import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Customer, CustomerListFilters, ListCustomersResponse, SaveCustomerRequest } from '../models/customer.model';
import { environment } from '../../../environments/environment';

const BASE_URL = `${environment.apiUrl}/customers`;

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private http = inject(HttpClient);

  list(filters?: CustomerListFilters): Observable<Customer[]> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.isActive !== undefined) params = params.set('isActive', filters.isActive);

    return this.http.get<ListCustomersResponse>(BASE_URL, { params }).pipe(map(res => res.items));
  }

  get(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${BASE_URL}/${id}`);
  }

  create(body: SaveCustomerRequest): Observable<Customer> {
    return this.http.post<Customer>(BASE_URL, body);
  }

  update(id: string, body: SaveCustomerRequest): Observable<Customer> {
    return this.http.put<Customer>(`${BASE_URL}/${id}`, body);
  }

  activate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/deactivate`, null);
  }
}
