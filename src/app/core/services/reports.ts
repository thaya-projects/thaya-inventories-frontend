import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProfitReport, ProfitReportGroupBy } from '../models/profit-report.model';

const BASE_URL = `${environment.apiUrl}/reports`;

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);

  getProfit(from: string, to: string, groupBy: ProfitReportGroupBy): Observable<ProfitReport> {
    const params = new HttpParams().set('from', from).set('to', to).set('groupBy', groupBy);
    return this.http.get<ProfitReport>(`${BASE_URL}/profit`, { params });
  }
}
