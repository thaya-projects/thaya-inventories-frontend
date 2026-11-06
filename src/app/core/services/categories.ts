import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category, CategoryListFilters, ListCategoriesResponse, SaveCategoryRequest } from '../models/category.model';

const BASE_URL = `${environment.apiUrl}/categories`;

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private http = inject(HttpClient);

  // tree=true: solo raíces en el array, con children anidados recursivamente.
  // tree=false (default): lista plana, children siempre [].
  list(tree: boolean, filters?: CategoryListFilters): Observable<Category[]> {
    let params = new HttpParams().set('tree', tree);
    if (filters?.isActive !== undefined) {
      params = params.set('isActive', filters.isActive);
    }

    return this.http
      .get<ListCategoriesResponse>(BASE_URL, { params })
      .pipe(map(res => res.items));
  }

  get(id: string): Observable<Category> {
    return this.http.get<Category>(`${BASE_URL}/${id}`);
  }

  create(body: SaveCategoryRequest): Observable<Category> {
    return this.http.post<Category>(BASE_URL, body);
  }

  update(id: string, body: SaveCategoryRequest): Observable<Category> {
    return this.http.put<Category>(`${BASE_URL}/${id}`, body);
  }

  uploadImage(id: string, file: File): Observable<Category> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<Category>(`${BASE_URL}/${id}/image`, body);
  }

  removeImage(id: string): Observable<Category> {
    return this.http.delete<Category>(`${BASE_URL}/${id}/image`);
  }

  activate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/deactivate`, null);
  }
}
