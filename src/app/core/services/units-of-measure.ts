import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SaveUnitOfMeasureRequest, UnitOfMeasure, UnitOfMeasureListFilters } from '../models/unit-of-measure.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/units-of-measure`;

@Injectable({ providedIn: 'root' })
export class UnitsOfMeasureService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: UnitOfMeasureListFilters): Observable<PagedResult<UnitOfMeasure>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.search) {
      params = params.set('search', filters.search);
    }
    if (filters?.isActive !== undefined) {
      params = params.set('isActive', filters.isActive);
    }

    return this.http.get<PagedResult<UnitOfMeasure>>(BASE_URL, { params });
  }

  get(id: string): Observable<UnitOfMeasure> {
    return this.http.get<UnitOfMeasure>(`${BASE_URL}/${id}`);
  }

  create(body: SaveUnitOfMeasureRequest): Observable<UnitOfMeasure> {
    return this.http.post<UnitOfMeasure>(BASE_URL, body);
  }

  update(id: string, body: SaveUnitOfMeasureRequest): Observable<UnitOfMeasure> {
    return this.http.put<UnitOfMeasure>(`${BASE_URL}/${id}`, body);
  }

  activate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/deactivate`, null);
  }
}
