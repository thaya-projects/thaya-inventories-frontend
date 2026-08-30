import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateUserRequest, ListUsersResponse, TeamUser, UpdateUserRequest } from '../models/user.model';

const BASE_URL = `${environment.apiUrl}/users`;

// Equipo de la empresa (rol Admin). Distinto de AuthService (sesión propia).
@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);

  list(): Observable<TeamUser[]> {
    return this.http.get<ListUsersResponse>(BASE_URL).pipe(map(res => res.users));
  }

  get(id: string): Observable<TeamUser> {
    return this.http.get<TeamUser>(`${BASE_URL}/${id}`);
  }

  create(body: CreateUserRequest): Observable<TeamUser> {
    return this.http.post<TeamUser>(BASE_URL, body);
  }

  update(id: string, body: UpdateUserRequest): Observable<TeamUser> {
    return this.http.put<TeamUser>(`${BASE_URL}/${id}`, body);
  }

  activate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(`${BASE_URL}/${id}/deactivate`, null);
  }

  resetPassword(id: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${BASE_URL}/${id}/reset-password`, {
      newPassword,
      confirmPassword: newPassword,
    });
  }
}
