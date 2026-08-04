import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTooltip } from '@angular/material/tooltip';
import { InvoiceService } from '../../../core/services/invoice.service';
import { ClientService } from '../../../core/services/client.service';
import { ToastService } from '../../../core/services/toast.service';
import { Client, Invoice } from '../../../core/models';
import { ConfirmService } from '../../../shared/confirm/confirm.service';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, NgClass, FormsModule, MatTooltip],
  styles: [`
    .filter-input { @apply w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all; }
  `],
  templateUrl: './invoice-list.component.html',
})
export class InvoiceListComponent implements OnInit {
  private invoiceService = inject(InvoiceService);
  private clientService = inject(ClientService);
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

  statuses = [
    { label: 'All', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Sent', value: 'sent' },
    { label: 'Paid', value: 'paid' },
  ];

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.clientService.list().subscribe(clients => this.clients.set(clients));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number | boolean> = {};
    if (this.selectedStatus()) params['status'] = this.selectedStatus();
    if (this.search) params['search'] = this.search;
    if (this.selectedClientId) params['client_id'] = parseInt(this.selectedClientId);
    if (this.dateFrom) params['date_from'] = this.dateFrom;
    if (this.dateTo) params['date_to'] = this.dateTo;
    if (this.showTemplates()) params['is_template'] = true;

    this.invoiceService.list(params).subscribe({
      next: (res) => {
        this.invoices.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 400);
  }

  filterStatus(status: string): void {
    this.selectedStatus.set(status);
    this.load();
  }

  toggleTemplates(): void {
    this.showTemplates.update(v => !v);
    this.selectedStatus.set('');
    this.load();
  }

  clearDates(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.load();
  }

  exportCSV(): void {
    const rows = [['Number', 'Client', 'Date', 'Status', 'Total']];
    for (const inv of this.invoices()) {
      rows.push([inv.invoice_number, inv.client_name || '', inv.date, inv.status, String(inv.total)]);
    }
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
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
