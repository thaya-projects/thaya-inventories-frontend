import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Expense,
  ExpenseListFilters,
  ExpensePaymentStatusResponse,
  SaveExpenseRequest,
} from '../models/expense.model';
import { PagedResult } from '../models/paged-result.model';

const BASE_URL = `${environment.apiUrl}/expenses`;

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private http = inject(HttpClient);

  list(page: number, pageSize: number, filters?: ExpenseListFilters): Observable<PagedResult<Expense>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.category) params = params.set('category', filters.category);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
    if (filters?.paid !== undefined) params = params.set('paid', filters.paid);

    return this.http.get<PagedResult<Expense>>(BASE_URL, { params });
  }

  get(id: string): Observable<Expense> {
    return this.http.get<Expense>(`${BASE_URL}/${id}`);
  }

  create(body: SaveExpenseRequest): Observable<Expense> {
    return this.http.post<Expense>(BASE_URL, body);
  }

  update(id: string, body: SaveExpenseRequest): Observable<Expense> {
    return this.http.put<Expense>(`${BASE_URL}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE_URL}/${id}`);
  }

  paymentStatus(id: string): Observable<ExpensePaymentStatusResponse> {
    return this.http.get<ExpensePaymentStatusResponse>(`${BASE_URL}/${id}/payment-status`);
  }
}
