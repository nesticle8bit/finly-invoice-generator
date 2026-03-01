import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InviteCode {
  id: number;
  code: string;
  created_at: string;
  used_at: string | null;
  used_by_name: string | null;
  used_by_email: string | null;
}

@Injectable({ providedIn: 'root' })
export class InviteService {
  private readonly base = `${environment.apiUrl}/invite-codes`;

  constructor(private http: HttpClient) {}

  list(): Observable<InviteCode[]> {
    return this.http.get<InviteCode[]>(this.base);
  }

  create(): Observable<InviteCode> {
    return this.http.post<InviteCode>(this.base, {});
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
