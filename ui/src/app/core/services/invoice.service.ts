import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Invoice, PaginatedResponse, DashboardStats, MonthStat } from '../models';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly base = `${environment.apiUrl}/invoices`;

  constructor(private http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base}/stats`);
  }

  getNextNumber(): Observable<{ number: string }> {
    return this.http.get<{ number: string }>(`${this.base}/next-number`);
  }

  list(params?: { status?: string; search?: string; page?: number; limit?: number; client_id?: number; date_from?: string; date_to?: string; is_template?: boolean }): Observable<PaginatedResponse<Invoice>> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params?.client_id) httpParams = httpParams.set('client_id', params.client_id.toString());
    if (params?.date_from) httpParams = httpParams.set('date_from', params.date_from);
    if (params?.date_to) httpParams = httpParams.set('date_to', params.date_to);
    if (params?.is_template !== undefined) httpParams = httpParams.set('is_template', params.is_template.toString());
    return this.http.get<PaginatedResponse<Invoice>>(this.base, { params: httpParams });
  }

  duplicate(id: number): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/${id}/duplicate`, {});
  }

  getMonthlyStats(): Observable<MonthStat[]> {
    return this.http.get<MonthStat[]>(`${this.base}/monthly-stats`);
  }

  getById(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/${id}`);
  }

  create(data: Partial<Invoice>): Observable<Invoice> {
    return this.http.post<Invoice>(this.base, data);
  }

  update(id: number, data: Partial<Invoice>): Observable<Invoice> {
    return this.http.put<Invoice>(`${this.base}/${id}`, data);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }

  downloadPDF(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }
}
