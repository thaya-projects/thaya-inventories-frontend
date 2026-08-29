import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SavePlanRequest, SubscriptionPlan, SubscriptionPlanListResponse } from '../models/subscription-plan.model';

const BASE_URL = `${environment.apiUrl}/subscription-plans`;

@Injectable({ providedIn: 'root' })
export class SubscriptionPlansService {
  private http = inject(HttpClient);

  // Sin paginación: el backend devuelve todos los planes que cumplan el filtro.
  list(isActive?: boolean): Observable<SubscriptionPlanListResponse> {
    let params = new HttpParams();
    if (isActive !== undefined) {
      params = params.set('isActive', isActive);
    }
    return this.http.get<SubscriptionPlanListResponse>(BASE_URL, { params });
  }

  get(id: string): Observable<SubscriptionPlan> {
    return this.http.get<SubscriptionPlan>(`${BASE_URL}/${id}`);
  }

  create(payload: SavePlanRequest): Observable<SubscriptionPlan> {
    return this.http.post<SubscriptionPlan>(BASE_URL, payload);
  }

  // PUT reemplaza todo el registro, no es un update parcial.
  update(id: string, payload: SavePlanRequest): Observable<SubscriptionPlan> {
    return this.http.put<SubscriptionPlan>(`${BASE_URL}/${id}`, payload);
  }

  activate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/deactivate`, null);
  }
}
