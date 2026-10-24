import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChangeCompanyModulePresetRequest,
  Company,
  CompanyListFilters,
  CreateCompanyRequest,
  CreateCompanyResponse,
  ResetAdminPasswordRequest,
  ResetAdminPasswordResponse,
  SetCompanyStorefrontRequest,
} from '../models/company.model';
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

  // PATCH /platform/companies/{id}/module-preset — confirmado contra el
  // OpenAPI real. Devuelve la empresa completa actualizada.
  changeModulePreset(id: string, payload: ChangeCompanyModulePresetRequest): Observable<Company> {
    return this.http.patch<Company>(`${BASE_URL}/${id}/module-preset`, payload);
  }

  // PATCH /platform/companies/{id}/storefront — activa/desactiva la landing pública.
  setStorefront(id: string, enabled: boolean): Observable<Company> {
    const body: SetCompanyStorefrontRequest = { enabled };
    return this.http.patch<Company>(`${BASE_URL}/${id}/storefront`, body);
  }

  // POST /platform/companies/{id}/logo — multipart, campo "file".
  uploadLogo(id: string, file: File): Observable<{ logoUrl: string | null }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ logoUrl: string | null }>(`${BASE_URL}/${id}/logo`, form);
  }

  resetAdminPassword(
    companyId: string,
    adminEmail: string,
    newPassword: string,
  ): Observable<ResetAdminPasswordResponse> {
    const body: ResetAdminPasswordRequest = { adminEmail, newPassword, confirmPassword: newPassword };
    return this.http.post<ResetAdminPasswordResponse>(`${BASE_URL}/${companyId}/reset-admin-password`, body);
  }
}
