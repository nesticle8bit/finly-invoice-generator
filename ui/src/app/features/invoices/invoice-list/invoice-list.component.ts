import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTooltip } from '@angular/material/tooltip';
import { InvoiceService } from '../../../core/services/invoice.service';
import { ToastService } from '../../../core/services/toast.service';
import { Invoice } from '../../../core/models';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, NgClass, FormsModule, MatTooltip],
  template: `
    <div class="p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Invoices</h1>
          <p class="text-slate-500 text-sm mt-0.5">{{ total() }} invoice(s) total</p>
        </div>
        <a routerLink="/invoices/new" class="btn-primary">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          New Invoice
        </a>
      </div>

      <!-- Filters -->
      <div class="card p-4 mb-5 flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            [(ngModel)]="search"
            (ngModelChange)="onSearch()"
            placeholder="Search by invoice # or client..."
            class="input-field pl-9"
          >
        </div>
        <div class="flex gap-2">
          @for (s of statuses; track s.value) {
            <button
              (click)="filterStatus(s.value)"
              class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all duration-200"
              [class.bg-primary-600]="selectedStatus() === s.value"
              [class.text-white]="selectedStatus() === s.value"
              [class.border-primary-600]="selectedStatus() === s.value"
              [class.bg-white]="selectedStatus() !== s.value"
              [class.text-slate-600]="selectedStatus() !== s.value"
              [class.border-slate-200]="selectedStatus() !== s.value"
            >{{ s.label }}</button>
          }
        </div>
      </div>

      <!-- Table -->
      <div class="card overflow-hidden">
        @if (loading()) {
          <div class="flex items-center justify-center h-48">
            <div class="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
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
                    <span class="text-sm font-bold text-primary-600">#{{ inv.invoice_number }}</span>
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
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      </a>
                      <a [routerLink]="['/invoices', inv.id, 'edit']" class="btn-ghost p-1.5" matTooltip="Edit">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </a>
                      <button (click)="downloadPDF(inv)" class="btn-ghost p-1.5" matTooltip="Download PDF">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </button>
                      <button (click)="deleteInvoice(inv)" class="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" matTooltip="Delete">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="text-center py-16 text-slate-400">
                    <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p class="font-medium">No invoices found</p>
                    <a routerLink="/invoices/new" class="text-primary-600 text-sm font-semibold hover:underline mt-1 inline-block">Create your first invoice →</a>
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
  private toast = inject(ToastService);

  invoices = signal<Invoice[]>([]);
  loading = signal(true);
  total = signal(0);
  search = '';
  selectedStatus = signal('');

  statuses = [
    { label: 'All', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Sent', value: 'sent' },
    { label: 'Paid', value: 'paid' },
  ];

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.selectedStatus()) params['status'] = this.selectedStatus();
    if (this.search) params['search'] = this.search;

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
