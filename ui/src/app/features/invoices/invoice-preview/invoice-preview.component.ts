import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from "@angular/router";
import { DatePipe, CurrencyPipe } from "@angular/common";
import { MoneyPipe } from "../../../shared/money/money.pipe";
import { FormsModule } from "@angular/forms";
import { InvoiceService } from "../../../core/services/invoice.service";
import { ProfileService } from "../../../core/services/profile.service";
import { ToastService } from "../../../core/services/toast.service";
import { ShareService, ShareInfo } from "../../../core/services/share.service";
import { Invoice, InvoiceStatus, Profile } from "../../../core/models";
import { environment } from "../../../../environments/environment";

@Component({
  selector: "app-invoice-preview",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, FormsModule, MoneyPipe],
  providers: [CurrencyPipe],
  templateUrl: './invoice-preview.component.html',
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
  shareError = signal("");
  sharePassword = "";
  shareExpiry: number | null = null;
  copied = signal(false);

  ngOnInit(): void {
    this.invoiceId = parseInt(this.route.snapshot.paramMap.get("id")!);
    this.loadInvoice();
    this.loadProfile();
  }

  loadInvoice(): void {
    this.invoiceService.getById(this.invoiceId).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.clientCurrency.set(inv.client_currency ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadProfile(): void {
    this.profileService.get().subscribe({ next: (p) => this.profile.set(p) });
  }

  getLogoUrl(): string {
    const p = this.profile();
    if (!p?.logo_path) return "";
    return `${environment.uploadsUrl}/${p.logo_path}`;
  }

  getSignatureUrl(): string {
    const p = this.profile();
    if (!p?.signature_path) return "";
    return `${environment.uploadsUrl}/${p.signature_path}`;
  }

  /** The client's currency wins over the profile default for this invoice. */
  invoiceCurrency(): string | null {
    return this.clientCurrency() ?? this.profile()?.currency ?? null;
  }

  private clientCurrency = signal<string | null>(null);

  getUserInitials(): string {
    const name = this.profile()?.name || "JP";
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  downloadPDF(): void {
    this.downloading.set(true);
    this.invoiceService.downloadPDF(this.invoiceId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoice-${this.invoice()?.invoice_number}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.success("PDF downloaded!");
        this.downloading.set(false);
      },
      error: () => {
        this.toast.error("Failed to generate PDF");
        this.downloading.set(false);
      },
    });
  }

  updatingStatus = signal(false);

  updateStatus(status: InvoiceStatus): void {
    this.updatingStatus.set(true);
    this.invoiceService.update(this.invoiceId, { status }).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.updatingStatus.set(false);
        this.toast.success(`Invoice marked as ${status}`);
      },
      error: () => {
        this.toast.error('Failed to update status');
        this.updatingStatus.set(false);
      },
    });
  }

  overdueDays(): number | null {
    const inv = this.invoice();
    if (!inv || inv.status !== 'sent' || !inv.sent_at) return null;
    const days = Math.floor((Date.now() - new Date(inv.sent_at).getTime()) / 86_400_000);
    return days > 30 ? days : null;
  }

  //  Share modal 

  shareUrl(): string {
    const token = this.shareInfo()?.token;
    return token ? `${window.location.origin}/share/${token}` : "";
  }

  openShareModal(): void {
    this.showShareModal.set(true);
    this.shareError.set("");
    this.shareService.getShareInfo(this.invoiceId).subscribe({
      next: (info) => this.shareInfo.set(info),
      error: () => this.shareInfo.set({ active: false }),
    });
  }

  closeShareModal(): void {
    this.showShareModal.set(false);
    this.sharePassword = "";
    this.shareExpiry = null;
    this.shareError.set("");
  }

  createLink(): void {
    if (!this.sharePassword) return;
    this.shareLoading.set(true);
    this.shareError.set("");
    this.shareService.createLink(this.invoiceId, this.sharePassword, this.shareExpiry ?? undefined).subscribe({
      next: (res) => {
        this.shareInfo.set({ active: true, token: res.token, expires_at: res.expires_at });
        this.shareLoading.set(false);
        this.sharePassword = "";
      },
      error: (err) => {
        this.shareError.set(err?.error?.error || "Failed to create link.");
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
        this.toast.success("Share link revoked.");
      },
      error: () => {
        this.shareLoading.set(false);
        this.toast.error("Failed to revoke link.");
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
