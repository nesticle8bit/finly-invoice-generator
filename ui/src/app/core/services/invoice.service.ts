import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Invoice, PaginatedResponse, DashboardStats } from '../models';

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

  list(params?: { status?: string; search?: string; page?: number; limit?: number }): Observable<PaginatedResponse<Invoice>> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<PaginatedResponse<Invoice>>(this.base, { params: httpParams });
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
