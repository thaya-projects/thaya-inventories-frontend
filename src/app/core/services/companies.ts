import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Company, CompanyListFilters, CreateCompanyRequest, CreateCompanyResponse } from '../models/company.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/platform/companies`;

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private http = inject(HttpClient);

  // Filtros soportados hoy por el backend: search (contra name o taxId) e
  // isActive. Cualquier otro campo de Company no es filtrable todavía.
  list(page: number, pageSize: number, filters?: CompanyListFilters): Observable<PagedResult<Company>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.search) {
      params = params.set('search', filters.search);
    }
    if (filters?.isActive !== undefined) {
      params = params.set('isActive', filters.isActive);
    }

    return this.http.get<PagedResult<Company>>(BASE_URL, { params });
  }

  create(payload: CreateCompanyRequest): Observable<CreateCompanyResponse> {
    return this.http.post<CreateCompanyResponse>(BASE_URL, payload);
  }

  get(id: string): Observable<Company> {
    return this.http.get<Company>(`${BASE_URL}/${id}`);
  }

  setActive(id: string, isActive: boolean): Observable<Company> {
    return this.http.put<Company>(`${BASE_URL}/${id}`, { isActive });
  }
}
