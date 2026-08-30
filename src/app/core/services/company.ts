import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyProfile, UpdateCompanyRequest, UpdateCompanySettingsRequest } from '../models/company-profile.model';
import { CompanySubscriptionView } from '../models/company-subscription-view.model';

// La empresa del usuario logueado (rutas /api/company/*) — distinto de
// CompaniesService, que es /platform/companies para el SuperAdmin.
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private http = inject(HttpClient);

  get(): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(`${environment.apiUrl}/company`);
  }

  update(body: UpdateCompanyRequest): Observable<CompanyProfile> {
    return this.http.put<CompanyProfile>(`${environment.apiUrl}/company`, body);
  }

  updateSettings(body: UpdateCompanySettingsRequest): Observable<CompanyProfile> {
    return this.http.put<CompanyProfile>(`${environment.apiUrl}/company/settings`, body);
  }

  getSubscription(): Observable<CompanySubscriptionView> {
    return this.http.get<CompanySubscriptionView>(`${environment.apiUrl}/company/subscription`);
  }
}
