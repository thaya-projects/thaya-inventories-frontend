import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Branch, ListBranchesResponse } from '../models/branch.model';

const BASE_URL = `${environment.apiUrl}/branches`;

@Injectable({ providedIn: 'root' })
export class BranchesService {
  private http = inject(HttpClient);

  list(): Observable<Branch[]> {
    return this.http.get<ListBranchesResponse>(BASE_URL).pipe(map(res => res.items));
  }
}
