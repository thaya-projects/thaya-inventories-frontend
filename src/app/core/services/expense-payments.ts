import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateExpensePaymentRequest } from '../models/expense-payment.model';

// Solo create — no hay GET /api/expenses/{id}/payments en el YAML. La lista
// de pagos de un gasto se pide con PaymentsService.list({ sourceId }).
@Injectable({ providedIn: 'root' })
export class ExpensePaymentsService {
  private http = inject(HttpClient);

  create(expenseId: string, body: CreateExpensePaymentRequest): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/expenses/${expenseId}/payments`, body);
  }
}
