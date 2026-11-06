import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateProductRequest,
  KardexFilters,
  Product,
  ProductKardex,
  ProductListFilters,
  UpdateProductRequest,
} from '../models/product.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/products`;

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: ProductListFilters): Observable<PagedResult<Product>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters?.productType) params = params.set('productType', filters.productType);
    if (filters?.isActive !== undefined) params = params.set('isActive', filters.isActive);
    if (filters?.tracksStock !== undefined) params = params.set('tracksStock', filters.tracksStock);
    if (filters?.hasVariants !== undefined) params = params.set('hasVariants', filters.hasVariants);
    if (filters?.lowStock) params = params.set('lowStock', true);

    return this.http.get<PagedResult<Product>>(BASE_URL, { params });
  }

  get(id: string): Observable<Product> {
    return this.http.get<Product>(`${BASE_URL}/${id}`);
  }

  create(body: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(BASE_URL, body);
  }

  update(id: string, body: UpdateProductRequest): Observable<Product> {
    return this.http.put<Product>(`${BASE_URL}/${id}`, body);
  }

  // Solo el precio de venta (ej. desde una compra cuando subió el costo).
  updateSalePrice(id: string, salePrice: number): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/sale-price`, { salePrice });
  }

  activate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/deactivate`, null);
  }

  // PATCH /products/{id}/feature — sin body, 204. Marcar uno desmarca al
  // anterior solo (lo resuelve el backend, no hay que gestionarlo acá).
  feature(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/feature`, null);
  }

  kardex(id: string, filters?: KardexFilters): Observable<ProductKardex> {
    let params = new HttpParams();
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

    return this.http.get<ProductKardex>(`${BASE_URL}/${id}/kardex`, { params });
  }
}
