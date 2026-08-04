import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SharedItem {
  id: number;
  description: string;
  description_clean: string;
  wp_number: string | null;
  hours: number;
  rate: number;
  amount: number;
  item_order: number;
}

export interface SharedInvoice {
  invoice_number: string;
  date: string;
  items: SharedItem[];
  /** Short-lived token so autosave doesn't resend the password. */
  session_token: string;
}

export interface ShareInfo {
  active: boolean;
  token?: string;
  expires_at?: string;
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class ShareService {
  private http = inject(HttpClient);

  private readonly base = environment.apiUrl;

  createLink(invoiceId: number, password: string, expiresInDays?: number): Observable<{ token: string; expires_at: string }> {
    return this.http.post<{ token: string; expires_at: string }>(
      `${this.base}/invoices/${invoiceId}/share`,
      { password, expires_in_days: expiresInDays ?? null }
    );
  }

  revokeLink(invoiceId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/invoices/${invoiceId}/share`);
  }

  getShareInfo(invoiceId: number): Observable<ShareInfo> {
    return this.http.get<ShareInfo>(`${this.base}/invoices/${invoiceId}/share`);
  }

  // Public — no auth
  accessInvoice(token: string, password: string): Observable<SharedInvoice> {
    return this.http.post<SharedInvoice>(`${this.base}/public/share/${token}`, { password });
  }

  updateWP(
    token: string,
    sessionToken: string,
    items: { id: number; wp_number: string | null }[]
  ): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.base}/public/share/${token}/wp`, {
      session_token: sessionToken,
      items,
    });
  }
}
