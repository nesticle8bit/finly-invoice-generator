import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTooltip } from '@angular/material/tooltip';
import { InvoiceService } from '../../../core/services/invoice.service';
import { ClientService } from '../../../core/services/client.service';
import { ToastService } from '../../../core/services/toast.service';
import { Client, Invoice } from '../../../core/models';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, NgClass, FormsModule, MatTooltip],
  styles: [`
    .filter-input { @apply w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all; }
  `],
  template: `
    <div class="p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ showTemplates() ? 'Templates' : 'Invoices' }}</h1>
          <p class="text-slate-500 text-sm mt-0.5">{{ total() }} {{ showTemplates() ? 'template(s)' : 'invoice(s)' }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="exportCSV()" class="btn-secondary gap-2 text-sm" matTooltip="Export visible invoices as CSV">
            <i class="ti ti-table-export text-base"></i>
            Export CSV
          </button>
          <button
            (click)="toggleTemplates()"
            class="btn-secondary gap-2 text-sm"
            [class.bg-primary-50]="showTemplates()"
            [class.text-primary-700]="showTemplates()"
            [class.border-primary-300]="showTemplates()"
          >
            <i class="ti ti-template text-base"></i>
            Templates
          </button>
          <a routerLink="/invoices/new" class="btn-primary gap-2">
            <i class="ti ti-plus text-base"></i>
            New Invoice
          </a>
        </div>
      </div>

      <!-- Filters -->
      <div class="card p-4 mb-5 space-y-3">
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Search -->
          <div class="relative flex-1">
            <i class="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
            <input
              type="text"
              [(ngModel)]="search"
              (ngModelChange)="onSearch()"
              placeholder="Search invoice # or client..."
              class="input-field pl-9"
            >
          </div>
          <!-- Client filter -->
          <div class="relative">
            <i class="ti ti-users absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
            <select [(ngModel)]="selectedClientId" (ngModelChange)="load()" class="input-field pl-9 pr-8 w-48">
              <option value="">All clients</option>
              @for (c of clients(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>
          <!-- Date range -->
          <div class="flex items-center gap-2">
            <div class="relative">
              <i class="ti ti-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
              <input type="date" [(ngModel)]="dateFrom" (ngModelChange)="load()" class="input-field pl-9 w-40 text-sm" placeholder="From">
            </div>
            <span class="text-slate-400 text-sm">→</span>
            <div class="relative">
              <i class="ti ti-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
              <input type="date" [(ngModel)]="dateTo" (ngModelChange)="load()" class="input-field pl-9 w-40 text-sm" placeholder="To">
            </div>
            @if (dateFrom || dateTo) {
              <button (click)="clearDates()" class="text-slate-400 hover:text-slate-600 transition-colors">
                <i class="ti ti-x text-base"></i>
              </button>
            }
          </div>
        </div>
        <!-- Status pills -->
        @if (!showTemplates()) {
          <div class="flex gap-2">
            @for (s of statuses; track s.value) {
              <button
                (click)="filterStatus(s.value)"
                class="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150"
                [class.bg-primary-600]="selectedStatus() === s.value"
                [class.text-white]="selectedStatus() === s.value"
                [class.border-primary-600]="selectedStatus() === s.value"
                [class.bg-white]="selectedStatus() !== s.value"
                [class.text-slate-600]="selectedStatus() !== s.value"
                [class.border-slate-200]="selectedStatus() !== s.value"
              >{{ s.label }}</button>
            }
          </div>
        }
      </div>

      <!-- Table -->
      <div class="card overflow-hidden">
        @if (loading()) {
          <div class="flex items-center justify-center h-48">
            <i class="ti ti-loader-2 text-3xl text-primary-600 animate-spin"></i>
          </div>
        } @else {
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-100">
                <th class="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoice #</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              @for (inv of invoices(); track inv.id) {
                <tr class="hover:bg-slate-50/60 transition-colors group">
                  <td class="px-6 py-3.5">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-bold text-primary-600">#{{ inv.invoice_number }}</span>
                      @if (inv.is_template) {
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">Template</span>
                      }
                    </div>
                  </td>
                  <td class="px-6 py-3.5">
                    <span class="text-sm text-slate-700">{{ inv.client_name || '—' }}</span>
                  </td>
                  <td class="px-6 py-3.5">
                    <span class="text-sm text-slate-500">{{ inv.date | date:'MMM d, y' }}</span>
                  </td>
                  <td class="px-6 py-3.5">
                    <span [ngClass]="{
                      'badge-paid': inv.status === 'paid',
                      'badge-sent': inv.status === 'sent',
                      'badge-draft': inv.status === 'draft'
                    }">{{ inv.status }}</span>
                  </td>
                  <td class="px-6 py-3.5 text-right">
                    <span class="text-sm font-bold text-slate-900">€{{ inv.total | number:'1.0-2' }}</span>
                  </td>
                  <td class="px-6 py-3.5">
                    <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a [routerLink]="['/invoices', inv.id, 'preview']" class="btn-ghost p-1.5" matTooltip="Preview">
                        <i class="ti ti-eye text-base"></i>
                      </a>
                      <a [routerLink]="['/invoices', inv.id, 'edit']" class="btn-ghost p-1.5" matTooltip="Edit">
                        <i class="ti ti-pencil text-base"></i>
                      </a>
                      <button (click)="duplicateInvoice(inv)" class="btn-ghost p-1.5" matTooltip="{{ inv.is_template ? 'Generate from template' : 'Duplicate' }}">
                        <i class="ti ti-copy text-base"></i>
                      </button>
                      <button (click)="downloadPDF(inv)" class="btn-ghost p-1.5" matTooltip="Download PDF">
                        <i class="ti ti-file-download text-base"></i>
                      </button>
                      <button (click)="deleteInvoice(inv)" class="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" matTooltip="Delete">
                        <i class="ti ti-trash text-base"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="text-center py-16 text-slate-400">
                    <i class="ti ti-file-off text-5xl text-slate-300 block mb-3"></i>
                    <p class="font-medium">{{ showTemplates() ? 'No templates yet' : 'No invoices found' }}</p>
                    <a routerLink="/invoices/new" class="text-primary-600 text-sm font-semibold hover:underline mt-1 inline-block">
                      {{ showTemplates() ? 'Create an invoice and save as template →' : 'Create your first invoice →' }}
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class InvoiceListComponent implements OnInit {
  private invoiceService = inject(InvoiceService);
  private clientService = inject(ClientService);
  private router = inject(Router);
  private toast = inject(ToastService);

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
    const params: Record<string, any> = {};
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

  deleteInvoice(inv: Invoice): void {
    if (!confirm(`Delete invoice #${inv.invoice_number}?`)) return;
    this.invoiceService.delete(inv.id).subscribe({
      next: () => {
        this.toast.success('Invoice deleted');
        this.load();
      },
      error: () => this.toast.error('Failed to delete invoice'),
    });
  }
}
