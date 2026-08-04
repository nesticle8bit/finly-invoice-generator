import { ChangeDetectionStrategy, Component, HostListener, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTooltip } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { InvoiceService } from '../../../core/services/invoice.service';
import { ClientService } from '../../../core/services/client.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProfileService } from '../../../core/services/profile.service';
import { Client, Invoice } from '../../../core/models';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { SkeletonRowsComponent } from '../../../shared/skeleton/skeleton.component';

export type SortColumn = 'invoice_number' | 'client_name' | 'date' | 'status' | 'total';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, NgClass, FormsModule, MatTooltip, MoneyPipe, SkeletonRowsComponent],
  providers: [CurrencyPipe],
  // A slash in a class binding name breaks the template parser, so the tint lives here.
  styles: [`.row-selected { @apply bg-primary-50/40; }`],
  templateUrl: './invoice-list.component.html',
})
export class InvoiceListComponent implements OnInit {
  private invoiceService = inject(InvoiceService);
  private clientService = inject(ClientService);
  private profileService = inject(ProfileService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);

  invoices = signal<Invoice[]>([]);
  clients = signal<Client[]>([]);
  loading = signal(true);
  total = signal(0);
  search = '';
  selectedStatus = signal('');
  showTemplates = signal(false);
  selectedClientId = '';
  dateFrom = '';
  dateTo = '';

  // Paging — the API has always paginated; the UI simply never asked for page 2.
  page = signal(1);
  readonly pageSize = 20;
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize + 1));
  rangeEnd = computed(() => Math.min(this.page() * this.pageSize, this.total()));

  // Sorting (server-side, against a whitelist of columns).
  sortColumn = signal<SortColumn>('date');
  sortAsc = signal(false);

  // Bulk selection
  selectedIds = signal<Set<number>>(new Set());
  selectedCount = computed(() => this.selectedIds().size);
  allVisibleSelected = computed(() => {
    const rows = this.invoices();
    return rows.length > 0 && rows.every((inv) => this.selectedIds().has(inv.id));
  });
  bulkRunning = signal(false);

  readonly sortableColumns: { key: SortColumn; label: string; alignRight?: boolean }[] = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'client_name', label: 'Client' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status' },
    { key: 'total', label: 'Total', alignRight: true },
  ];

  statuses = [
    { label: 'All', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Sent', value: 'sent' },
    { label: 'Paid', value: 'paid' },
  ];

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.clientService.list().subscribe((clients) => this.clients.set(clients));
    this.profileService.get().subscribe();
    this.load();
  }

  /** `n` opens a new invoice, `/` or Ctrl+K focuses search — this screen is used all day. */
  @HostListener('document:keydown', ['$event'])
  onShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = !!target?.closest('input, textarea, select');

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.focusSearch();
      return;
    }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === '/') {
      event.preventDefault();
      this.focusSearch();
    } else if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      this.router.navigate(['/invoices/new']);
    }
  }

  private focusSearch(): void {
    document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
  }

  load(): void {
    this.loading.set(true);
    this.invoiceService
      .list({
        page: this.page(),
        limit: this.pageSize,
        sort: this.sortColumn(),
        order: this.sortAsc() ? 'asc' : 'desc',
        status: this.selectedStatus() || undefined,
        search: this.search || undefined,
        client_id: this.selectedClientId ? parseInt(this.selectedClientId, 10) : undefined,
        date_from: this.dateFrom || undefined,
        date_to: this.dateTo || undefined,
        is_template: this.showTemplates() ? true : undefined,
      })
      .subscribe({
        next: (res) => {
          this.invoices.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  /** Any filter change invalidates the current page number. */
  private reload(): void {
    this.page.set(1);
    this.selectedIds.set(new Set());
    this.load();
  }

  onFilterChange(): void {
    this.reload();
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(), 400);
  }

  filterStatus(status: string): void {
    this.selectedStatus.set(status);
    this.reload();
  }

  toggleTemplates(): void {
    this.showTemplates.update((v) => !v);
    this.selectedStatus.set('');
    this.reload();
  }

  clearDates(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.reload();
  }

  sortBy(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortAsc.update((v) => !v);
    } else {
      this.sortColumn.set(column);
      this.sortAsc.set(column !== 'date' && column !== 'total');
    }
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(page, 1), this.totalPages());
    if (target === this.page()) return;
    this.page.set(target);
    this.selectedIds.set(new Set());
    this.load();
  }

  //  Bulk selection

  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: number): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAll(): void {
    const allSelected = this.allVisibleSelected();
    this.selectedIds.set(allSelected ? new Set() : new Set(this.invoices().map((i) => i.id)));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  async bulkDelete(): Promise<void> {
    const ids = [...this.selectedIds()];
    const confirmed = await this.confirmService.ask({
      title: `Delete ${ids.length} invoice(s)`,
      message: 'The selected invoices and all of their items will be permanently deleted.',
      confirmLabel: 'Delete all',
      danger: true,
    });
    if (!confirmed) return;

    this.bulkRunning.set(true);
    forkJoin(ids.map((id) => this.invoiceService.delete(id))).subscribe({
      next: () => this.afterBulk(`${ids.length} invoice(s) deleted`),
      error: () => this.failBulk('Some invoices could not be deleted'),
    });
  }

  bulkMarkPaid(): void {
    const ids = [...this.selectedIds()];
    this.bulkRunning.set(true);
    forkJoin(ids.map((id) => this.invoiceService.update(id, { status: 'paid' }))).subscribe({
      next: () => this.afterBulk(`${ids.length} invoice(s) marked as paid`),
      error: () => this.failBulk('Some invoices could not be updated'),
    });
  }

  private afterBulk(message: string): void {
    this.bulkRunning.set(false);
    this.selectedIds.set(new Set());
    this.toast.success(message);
    this.load();
  }

  private failBulk(message: string): void {
    this.bulkRunning.set(false);
    this.toast.error(message);
    this.load();
  }

  //  Row actions

  exportCSV(): void {
    const rows = [['Number', 'Client', 'Date', 'Status', 'Total']];
    for (const inv of this.invoices()) {
      rows.push([inv.invoice_number, inv.client_name || '', inv.date, inv.status, String(inv.total)]);
    }
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  duplicateInvoice(inv: Invoice): void {
    this.invoiceService.duplicate(inv.id).subscribe({
      next: (newInv) => {
        this.toast.success(inv.is_template ? 'Invoice created from template' : 'Invoice duplicated');
        this.router.navigate(['/invoices', newInv.id, 'edit']);
      },
      error: () => this.toast.error('Failed to duplicate invoice'),
    });
  }

  downloadPDF(inv: Invoice): void {
    this.invoiceService.downloadPDF(inv.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${inv.invoice_number}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.success('PDF downloaded!');
      },
      error: () => this.toast.error('Failed to download PDF'),
    });
  }

  async deleteInvoice(inv: Invoice): Promise<void> {
    const confirmed = await this.confirmService.ask({
      title: 'Delete invoice',
      message: `Invoice #${inv.invoice_number} and all of its items will be permanently deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.invoiceService.delete(inv.id).subscribe({
      next: () => {
        this.toast.success('Invoice deleted');
        this.load();
      },
      error: () => this.toast.error('Failed to delete invoice'),
    });
  }
}
