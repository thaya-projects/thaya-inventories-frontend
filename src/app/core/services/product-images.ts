import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ListProductImagesResponse, ProductImage, UpdateProductImageRequest } from '../models/product-image.model';

const baseUrl = (productId: string) => `${environment.apiUrl}/products/${productId}/images`;

@Injectable({ providedIn: 'root' })
export class ProductImagesService {
  private http = inject(HttpClient);

  list(productId: string): Observable<ProductImage[]> {
    return this.http.get<ListProductImagesResponse>(baseUrl(productId)).pipe(map(res => res.items));
  }

  // multipart/form-data — sin Content-Type manual, el browser arma el
  // boundary solo. El authInterceptor solo agrega el header Authorization,
  // no toca Content-Type, así que no hace falta nada especial acá.
  upload(productId: string, file: File, isPrimary: boolean, sortOrder: number): Observable<ProductImage> {
    const form = new FormData();
    form.append('File', file);
    form.append('IsPrimary', String(isPrimary));
    form.append('SortOrder', String(sortOrder));

    return this.http.post<ProductImage>(baseUrl(productId), form);
  }

  update(productId: string, imageId: string, body: UpdateProductImageRequest): Observable<ProductImage> {
    return this.http.put<ProductImage>(`${baseUrl(productId)}/${imageId}`, body);
  }

  delete(productId: string, imageId: string): Observable<void> {
    return this.http.delete<void>(`${baseUrl(productId)}/${imageId}`);
  }

  setPrimary(productId: string, imageId: string): Observable<void> {
    return this.http.patch<void>(`${baseUrl(productId)}/${imageId}/set-primary`, null);
  }
}
