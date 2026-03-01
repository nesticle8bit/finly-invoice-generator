import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { InvoiceService } from '../../core/services/invoice.service';
import { DashboardStats } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, NgClass],
  template: `
    <div class="p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p class="text-slate-500 text-sm mt-0.5">{{ today | date:'EEEE, MMMM d, y' }}</p>
        </div>
        <a routerLink="/invoices/new" class="btn-primary">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          New Invoice
        </a>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center h-64">
          <div class="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      } @else if (stats()) {
        <!-- Stats Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div class="card p-5">
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</span>
            </div>
            <p class="text-3xl font-bold text-slate-900">{{ stats()!.total_invoices }}</p>
            <p class="text-xs text-slate-500 mt-0.5">All invoices</p>
          </div>

          <div class="card p-5">
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Paid</span>
            </div>
            <p class="text-3xl font-bold text-emerald-600">{{ stats()!.paid_invoices }}</p>
            <p class="text-xs text-slate-500 mt-0.5">Completed</p>
          </div>

          <div class="card p-5">
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Revenue</span>
            </div>
            <p class="text-2xl font-bold text-slate-900">€{{ stats()!.total_revenue | number:'1.0-0' }}</p>
            <p class="text-xs text-slate-500 mt-0.5">All time</p>
          </div>

          <div class="card p-5">
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month</span>
            </div>
            <p class="text-2xl font-bold text-accent-600">€{{ stats()!.month_revenue | number:'1.0-0' }}</p>
            <p class="text-xs text-slate-500 mt-0.5">Current month</p>
          </div>
        </div>

        <!-- Recent Invoices -->
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 class="font-semibold text-slate-900 text-sm">Recent Invoices</h2>
            <a routerLink="/invoices" class="text-primary-600 text-xs font-semibold hover:text-primary-700">View all →</a>
          </div>
          <div class="divide-y divide-slate-50">
            @for (inv of stats()!.recent_invoices; track inv.id) {
              <a
                [routerLink]="['/invoices', inv.id, 'preview']"
                class="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors group"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                    <span class="text-primary-600 text-xs font-bold">#</span>
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">{{ inv.invoice_number }}</p>
                    <p class="text-xs text-slate-500">{{ inv.client_name || 'No client' }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  <p class="text-xs text-slate-400">{{ inv.date | date:'MMM d, y' }}</p>
                  <span [ngClass]="{
                    'badge-paid': inv.status === 'paid',
                    'badge-sent': inv.status === 'sent',
                    'badge-draft': inv.status === 'draft'
                  }">{{ inv.status }}</span>
                  <p class="text-sm font-bold text-slate-900 min-w-[70px] text-right">€{{ inv.total | number:'1.0-2' }}</p>
                </div>
              </a>
            } @empty {
              <div class="text-center py-12 text-slate-400">
                <p class="text-sm">No invoices yet.</p>
                <a routerLink="/invoices/new" class="text-primary-600 text-sm font-semibold hover:underline mt-1 inline-block">Create your first invoice →</a>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private invoiceService = inject(InvoiceService);

  stats = signal<DashboardStats | null>(null);
  loading = signal(true);
  today = new Date();

  ngOnInit(): void {
    this.invoiceService.getStats().subscribe({
      next: (s) => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
