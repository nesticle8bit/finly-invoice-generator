import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoiceService } from '../../../core/services/invoice.service';
import { ProfileService } from '../../../core/services/profile.service';
import { ToastService } from '../../../core/services/toast.service';
import { ShareService, ShareInfo } from '../../../core/services/share.service';
import { Invoice, Profile } from '../../../core/models';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-invoice-preview',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, FormsModule],
  template: `
    <div class="min-h-screen bg-dark-100">
      <!-- Toolbar -->
      <div class="bg-dark-900 border-b border-white/5 px-8 py-3 flex items-center justify-between sticky top-0 z-10">
        <div class="flex items-center gap-3">
          <a [routerLink]="['/invoices']" class="text-slate-400 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </a>
          <div>
            <p class="text-white font-semibold text-sm">Invoice #{{ invoice()?.invoice_number }}</p>
            <p class="text-slate-400 text-xs">{{ invoice()?.client_name }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          @if (invoice()?.status === 'draft') {
            <button (click)="openShareModal()" class="btn-secondary text-sm py-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
              Share for WP
            </button>
          }
          <a [routerLink]="['/invoices', invoiceId, 'edit']" class="btn-secondary text-sm py-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Edit
          </a>
          <button (click)="downloadPDF()" [disabled]="downloading()" class="btn-primary text-sm py-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            {{ downloading() ? 'Generating...' : 'Download PDF' }}
          </button>
        </div>
      </div>

      <!-- Invoice Preview -->
      <div class="flex justify-center py-10 px-4">
        @if (loading()) {
          <div class="flex items-center justify-center h-64">
            <div class="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        } @else if (invoice()) {
          <!-- A4 Paper -->
          <div class="invoice-preview bg-white shadow-2xl w-[794px] min-h-[1123px] rounded-sm" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; color:#1f2937;">
            <div style="padding:48px 52px;">

              <!-- Header -->
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px;">
                <div>
                  @if (profile()?.logo_path) {
                    <img [src]="getLogoUrl()" alt="Logo" style="height:64px; width:auto; object-fit:contain;">
                  } @else {
                    <div style="font-size:52px; font-weight:900; color:#06b6d4; letter-spacing:-2px; line-height:1;">
                      {{ getUserInitials() }}
                    </div>
                  }
                </div>
                <div style="text-align:right; font-size:12px; color:#374151; line-height:1.7;">
                  <div style="font-size:14px; font-weight:700; color:#111827;">{{ profile()?.name }}</div>
                  @if (profile()?.vat) { <div>VAT: {{ profile()?.vat }}</div> }
                  @if (profile()?.email) { <div>{{ profile()?.email }}</div> }
                  @if (profile()?.phone) { <div>{{ profile()?.phone }}</div> }
                </div>
              </div>

              <!-- Bill To + Invoice Info -->
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px;">
                <div>
                  <div style="font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;">Bill To</div>
                  <div style="font-size:14px; font-weight:700; color:#111827; margin-bottom:4px;">{{ invoice()?.client_name }}</div>
                  @if (invoice()?.client_address) {
                    <div style="font-size:13px; color:#374151; line-height:1.7;">
                      {{ invoice()?.client_address }}<br>
                      @if (invoice()?.client_postal_code || invoice()?.client_city) {
                        {{ invoice()?.client_postal_code }} {{ invoice()?.client_city }}<br>
                      }
                      @if (invoice()?.client_vat) { VAT: {{ invoice()?.client_vat }} }
                    </div>
                  }
                </div>
                <div style="text-align:right;">
                  <div style="font-size:28px; font-weight:800; color:#111827; margin-bottom:12px;">Invoice</div>
                  <div style="margin-bottom:4px;">
                    <div style="font-size:10px; color:#9ca3af; letter-spacing:1px; text-transform:uppercase;">N°</div>
                    <div style="font-size:15px; font-weight:700; color:#111827;">{{ invoice()?.invoice_number }}</div>
                  </div>
                  <div>
                    <div style="font-size:10px; color:#9ca3af; letter-spacing:1px; text-transform:uppercase;">Date</div>
                    <div style="font-size:13px; font-weight:700; color:#111827;">{{ invoice()?.date | date:'MMMM dd, yyyy' }}</div>
                  </div>
                </div>
              </div>

              <!-- Items Table -->
              <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
                <thead>
                  <tr>
                    <th style="padding:10px 16px; font-size:10px; font-weight:700; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase; border-bottom:2px solid #e5e7eb; text-align:left;">Task Description</th>
                    <th style="padding:10px 16px; font-size:10px; font-weight:700; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase; border-bottom:2px solid #e5e7eb; text-align:center;">Hours</th>
                    <th style="padding:10px 16px; font-size:10px; font-weight:700; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase; border-bottom:2px solid #e5e7eb; text-align:center;">Rate</th>
                    <th style="padding:10px 16px; font-size:10px; font-weight:700; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase; border-bottom:2px solid #e5e7eb; text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of invoice()?.items; track $index; let i = $index) {
                    <tr [style.background]="i % 2 === 0 ? '#f9fafb' : '#ffffff'">
                      <td style="padding:10px 16px; font-size:12px; color:#374151; border-bottom:1px solid #f3f4f6;">{{ item.description }}</td>
                      <td style="padding:10px 16px; font-size:12px; color:#374151; text-align:center; border-bottom:1px solid #f3f4f6;">{{ item.hours }}</td>
                      <td style="padding:10px 16px; font-size:12px; color:#374151; text-align:center; border-bottom:1px solid #f3f4f6;">{{ item.rate }} €</td>
                      <td style="padding:10px 16px; font-size:12px; color:#374151; text-align:right; border-bottom:1px solid #f3f4f6;">{{ item.amount | number:'1.0-2' }} €</td>
                    </tr>
                  }
                </tbody>
              </table>

              <!-- Total -->
              <div style="display:flex; justify-content:flex-end; margin-bottom:40px;">
                <div style="display:flex; align-items:center; gap:24px;">
                  <span style="font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase;">Total</span>
                  <span style="font-size:28px; font-weight:900; color:#6366f1;">{{ invoice()?.total | number:'1.0-2' }} €</span>
                </div>
              </div>

              <!-- Payment Info -->
              @if (profile()?.swift || profile()?.iban) {
                <div style="border-top:1px solid #e5e7eb; padding-top:24px; margin-bottom:24px;">
                  <p style="font-size:12px; color:#6b7280; margin-bottom:12px;">Transfer the amount to the account below</p>
                  <div style="display:flex; gap:32px;">
                    @if (profile()?.swift) {
                      <div>
                        <div style="font-size:10px; color:#9ca3af; letter-spacing:1px; text-transform:uppercase;">SWIFT/BIC</div>
                        <div style="font-size:13px; font-weight:700; color:#111827;">{{ profile()?.swift }}</div>
                      </div>
                    }
                    @if (profile()?.iban) {
                      <div>
                        <div style="font-size:10px; color:#9ca3af; letter-spacing:1px; text-transform:uppercase;">IBAN</div>
                        <div style="font-size:13px; font-weight:700; color:#111827;">{{ profile()?.iban }}</div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Notes -->
              @if (invoice()?.notes) {
                <div style="margin-bottom:40px;">
                  <div style="font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;">Notes</div>
                  <p style="font-size:12px; color:#6b7280; line-height:1.6;">{{ invoice()?.notes }}</p>
                </div>
              }

              <!-- Signature -->
              @if (profile()?.signature_path) {
                <div>
                  <img [src]="getSignatureUrl()" alt="Signature" style="height:60px; width:auto;">
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- ===================== Share Modal ===================== -->
    @if (showShareModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="closeShareModal()"></div>

        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 class="text-base font-bold text-slate-800">Share for WP Entry</h3>
              <p class="text-xs text-slate-500 mt-0.5">Collaborators can add Work Package numbers without an account.</p>
            </div>
            <button (click)="closeShareModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="px-6 py-5 space-y-5">

            <!-- Current link status -->
            @if (shareInfo()?.active) {
              <!-- Link is active -->
              <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span class="text-sm font-semibold text-emerald-700">Active share link</span>
                  @if (shareInfo()?.expires_at) {
                    <span class="ml-auto text-xs text-emerald-600">Expires {{ shareInfo()?.expires_at | date:'MMM d, y' }}</span>
                  }
                </div>
                <div class="flex items-center gap-2">
                  <input
                    [value]="shareUrl()"
                    readonly
                    class="flex-1 text-xs bg-white border border-emerald-200 rounded-lg px-3 py-2 text-slate-700 font-mono"
                  />
                  <button (click)="copyLink()" class="btn-secondary text-xs py-2 px-3 flex-shrink-0">
                    @if (copied()) {
                      <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                      </svg>
                    } @else {
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                      </svg>
                    }
                    {{ copied() ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
              </div>

              <!-- Revoke button -->
              <button (click)="revokeLink()" [disabled]="shareLoading()" class="btn-danger w-full justify-center text-sm py-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                </svg>
                Revoke Link
              </button>

            } @else {
              <!-- No active link — create form -->
              <div class="space-y-4">
                <div>
                  <label class="label">Password for collaborator</label>
                  <input
                    type="text"
                    [(ngModel)]="sharePassword"
                    name="sharePassword"
                    class="input-field"
                    placeholder="e.g. p4ssw0rd"
                  />
                  <p class="text-xs text-slate-400 mt-1">Share this password along with the link.</p>
                </div>
                <div>
                  <label class="label">Expires in (optional)</label>
                  <select [(ngModel)]="shareExpiry" name="shareExpiry" class="input-field">
                    <option [ngValue]="null">Never</option>
                    <option [ngValue]="1">1 day</option>
                    <option [ngValue]="3">3 days</option>
                    <option [ngValue]="7">7 days</option>
                    <option [ngValue]="30">30 days</option>
                  </select>
                </div>

                @if (shareError()) {
                  <p class="text-sm text-red-600">{{ shareError() }}</p>
                }

                <button
                  (click)="createLink()"
                  [disabled]="shareLoading() || !sharePassword"
                  class="btn-primary w-full justify-center"
                >
                  @if (shareLoading()) {
                    <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  } @else {
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                  }
                  Generate Share Link
                </button>
              </div>
            }

          </div>
        </div>
      </div>
    }
  `,
})
export class InvoicePreviewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private invoiceService = inject(InvoiceService);
  private profileService = inject(ProfileService);
  private toast = inject(ToastService);
  private shareService = inject(ShareService);

  invoice = signal<Invoice | null>(null);
  profile = signal<Profile | null>(null);
  loading = signal(true);
  downloading = signal(false);
  invoiceId!: number;

  // Share modal state
  showShareModal = signal(false);
  shareInfo = signal<ShareInfo | null>(null);
  shareLoading = signal(false);
  shareError = signal('');
  sharePassword = '';
  shareExpiry: number | null = null;
  copied = signal(false);

  ngOnInit(): void {
    this.invoiceId = parseInt(this.route.snapshot.paramMap.get('id')!);
    this.loadInvoice();
    this.loadProfile();
  }

  loadInvoice(): void {
    this.invoiceService.getById(this.invoiceId).subscribe({
      next: (inv) => { this.invoice.set(inv); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadProfile(): void {
    this.profileService.get().subscribe({ next: (p) => this.profile.set(p) });
  }

  getLogoUrl(): string {
    const p = this.profile();
    if (!p?.logo_path) return '';
    return `${environment.uploadsUrl}/${p.logo_path}`;
  }

  getSignatureUrl(): string {
    const p = this.profile();
    if (!p?.signature_path) return '';
    return `${environment.uploadsUrl}/${p.signature_path}`;
  }

  getUserInitials(): string {
    const name = this.profile()?.name || 'JP';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  downloadPDF(): void {
    this.downloading.set(true);
    this.invoiceService.downloadPDF(this.invoiceId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${this.invoice()?.invoice_number}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.success('PDF downloaded!');
        this.downloading.set(false);
      },
      error: () => {
        this.toast.error('Failed to generate PDF');
        this.downloading.set(false);
      },
    });
  }

  // ─── Share modal ───────────────────────────────────────────────

  shareUrl(): string {
    const token = this.shareInfo()?.token;
    return token ? `${window.location.origin}/share/${token}` : '';
  }

  openShareModal(): void {
    this.showShareModal.set(true);
    this.shareError.set('');
    this.shareService.getShareInfo(this.invoiceId).subscribe({
      next: (info) => this.shareInfo.set(info),
      error: () => this.shareInfo.set({ active: false }),
    });
  }

  closeShareModal(): void {
    this.showShareModal.set(false);
    this.sharePassword = '';
    this.shareExpiry = null;
    this.shareError.set('');
  }

  createLink(): void {
    if (!this.sharePassword) return;
    this.shareLoading.set(true);
    this.shareError.set('');
    this.shareService.createLink(this.invoiceId, this.sharePassword, this.shareExpiry ?? undefined).subscribe({
      next: (res) => {
        this.shareInfo.set({ active: true, token: res.token, expires_at: res.expires_at });
        this.shareLoading.set(false);
        this.sharePassword = '';
      },
      error: (err) => {
        this.shareError.set(err?.error?.error || 'Failed to create link.');
        this.shareLoading.set(false);
      },
    });
  }

  revokeLink(): void {
    this.shareLoading.set(true);
    this.shareService.revokeLink(this.invoiceId).subscribe({
      next: () => {
        this.shareInfo.set({ active: false });
        this.shareLoading.set(false);
        this.toast.success('Share link revoked.');
      },
      error: () => {
        this.shareLoading.set(false);
        this.toast.error('Failed to revoke link.');
      },
    });
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareUrl()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
