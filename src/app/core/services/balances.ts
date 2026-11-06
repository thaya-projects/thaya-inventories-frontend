import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// GET /api/dashboard/receivables (Admin, Assistant) y /payables (Admin).
// Saldos de siempre, no solo del mes; más antiguos primero.
export type BalanceSourceType = 'SalesOrder' | 'Purchase' | 'Expense';

export interface BalanceItem {
  sourceType: BalanceSourceType;
  sourceId: string;
  number: number | null;
  date: string;
  label: string; // "Venta #2", "Compra #1" o la descripción del gasto
  partyName: string | null; // cliente o proveedor
  total: number;
  paid: number;
  balance: number;
  daysOutstanding: number;
}

export interface BalancesResponse {
  totalBalance: number;
  count: number;
  items: BalanceItem[];
}

const BASE_URL = `${environment.apiUrl}/dashboard`;

@Injectable({ providedIn: 'root' })
export class BalancesService {
  private http = inject(HttpClient);

  receivables(): Observable<BalancesResponse> {
    return this.http.get<BalancesResponse>(`${BASE_URL}/receivables`);
  }

  payables(): Observable<BalancesResponse> {
    return this.http.get<BalancesResponse>(`${BASE_URL}/payables`);
  }
}
