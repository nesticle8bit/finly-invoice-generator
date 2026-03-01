import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Profile } from '../models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly base = `${environment.apiUrl}/profile`;

  constructor(private http: HttpClient) {}

  get(): Observable<Profile> {
    return this.http.get<Profile>(this.base);
  }

  update(data: Partial<Profile>): Observable<Profile> {
    return this.http.put<Profile>(this.base, data);
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
