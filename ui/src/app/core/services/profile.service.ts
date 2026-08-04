import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Profile } from '../models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/profile`;

  /** Default currency, kept here so MoneyPipe can format without a fetch per row. */
  readonly currency = signal<string>('EUR');

  get(): Observable<Profile> {
    return this.http.get<Profile>(this.base).pipe(tap((p) => this.cacheCurrency(p)));
  }

  update(data: Partial<Profile>): Observable<Profile> {
    return this.http.put<Profile>(this.base, data).pipe(tap((p) => this.cacheCurrency(p)));
  }

  private cacheCurrency(profile: Profile): void {
    if (profile?.currency) this.currency.set(profile.currency.toUpperCase());
  }

  uploadLogo(file: File): Observable<{ logo_path: string; url: string }> {
    const form = new FormData();
    form.append('logo', file);
    return this.http.post<{ logo_path: string; url: string }>(`${this.base}/logo`, form);
  }

  uploadSignature(file: File): Observable<{ signature_path: string; url: string }> {
    const form = new FormData();
    form.append('signature', file);
    return this.http.post<{ signature_path: string; url: string }>(`${this.base}/signature`, form);
  }

  getLogoUrl(path: string): string {
    if (!path) return '';
    return `${environment.uploadsUrl}/${path}`;
  }

  getSignatureUrl(path: string): string {
    if (!path) return '';
    return `${environment.uploadsUrl}/${path}`;
  }
}
