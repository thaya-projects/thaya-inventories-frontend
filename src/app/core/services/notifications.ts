import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ListNotificationsResponse, NotificationListFilters, UnreadCountResponse } from '../models/notification.model';

const BASE_URL = `${environment.apiUrl}/notifications`;

// Singleton (providedIn: root): además del CRUD, guarda el contador de no
// leídas como estado compartido — así la campana y la página /notifications
// se mantienen en sync sin esperar al próximo polling (ej. "marcar todas"
// desde la página baja el badge de la campana al instante).
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);

  unreadCount = signal(0);

  refreshUnreadCount(): void {
    this.http.get<UnreadCountResponse>(`${BASE_URL}/unread-count`).subscribe({
      next: res => this.unreadCount.set(res.count),
      error: () => { /* no crítico — la campana simplemente no actualiza este ciclo */ },
    });
  }

  getList(page: number, pageSize: number, filters?: NotificationListFilters): Observable<ListNotificationsResponse> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters?.isRead !== undefined) params = params.set('isRead', filters.isRead);
    if (filters?.type) params = params.set('type', filters.type);

    return this.http.get<ListNotificationsResponse>(BASE_URL, { params });
  }

  markRead(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/read`, null);
  }

  markAllRead(): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/read-all`, null);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE_URL}/${id}`);
  }
}
