import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ListTransportersResponse, Transporter } from '../models/transporter.model';
import { environment } from '../../../environments/environment';

const BASE_URL = `${environment.apiUrl}/transporters`;

// Solo lectura por ahora — el combo de la venta alcanza, CRUD se agrega si lo piden.
@Injectable({ providedIn: 'root' })
export class TransportersService {
  private http = inject(HttpClient);

  list(isActive?: boolean): Observable<Transporter[]> {
    let params = new HttpParams();
    if (isActive !== undefined) params = params.set('isActive', isActive);

    return this.http.get<ListTransportersResponse>(BASE_URL, { params }).pipe(map(res => res.items));
  }
}
