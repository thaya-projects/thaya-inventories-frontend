import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LotKind, NextLotCodeResponse } from '../models/lot.model';

const BASE_URL = `${environment.apiUrl}/lots`;

@Injectable({ providedIn: 'root' })
export class LotsService {
  private http = inject(HttpClient);

  // productId solo es obligatorio en el backend si includeProductCode está
  // activado en la empresa — lo mandamos igual cuando lo tenemos, no molesta.
  next(kind: LotKind, productId?: string | null): Observable<NextLotCodeResponse> {
    let params = new HttpParams().set('kind', kind);
    if (productId) params = params.set('productId', productId);

    return this.http.get<NextLotCodeResponse>(`${BASE_URL}/next`, { params });
  }
}
