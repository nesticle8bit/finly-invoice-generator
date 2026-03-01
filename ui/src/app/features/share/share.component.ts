import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ShareService, SharedInvoice, SharedItem } from '../../core/services/share.service';

@Component({
  selector: 'app-share',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">

      <!-- Logo / Brand -->
      <div class="mb-8 text-center">
        <div class="text-4xl font-black text-primary-600 tracking-tight">Invoice</div>
        <p class="text-slate-500 text-sm mt-1">Work Package Entry</p>
      </div>

      <!-- Password gate -->
      @if (!invoice()) {
        <div class="w-full max-w-sm">
          <div class="card p-8">
            <h2 class="text-lg font-bold text-slate-800 mb-1">Protected Invoice</h2>
            <p class="text-slate-500 text-sm mb-6">Enter the password to access and update Work Package numbers.</p>

            @if (error()) {
              <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {{ error() }}
              </div>
            }

            <form (ngSubmit)="unlock()" class="space-y-4">
              <div>
                <label class="label">Password</label>
                <input
                  type="password"
                  [(ngModel)]="password"
                  name="password"
                  class="input-field"
                  placeholder="Enter password"
                  autocomplete="current-password"
                  required
                />
              </div>
              <button type="submit" [disabled]="loading() || !password" class="btn-primary w-full justify-center">
                @if (loading()) {
                  <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                }
                Access Invoice
              </button>
            </form>
          </div>
        </div>
      }

      <!-- Invoice editor -->
      @if (invoice()) {
        <div class="w-full max-w-3xl">

          <!-- Header -->
          <div class="card p-6 mb-6">
            <div class="flex justify-between items-start">
              <div>
                <h2 class="text-xl font-bold text-slate-800">Invoice #{{ invoice()!.invoice_number }}</h2>
                <p class="text-slate-500 text-sm mt-0.5">{{ invoice()!.date }}</p>
              </div>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                Draft — WP Entry Mode
              </span>
            </div>
          </div>

          <!-- Save banner -->
          @if (saved()) {
            <div class="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Work Package numbers saved successfully!
            </div>
          }

          @if (saveError()) {
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {{ saveError() }}
            </div>
          }

          <!-- Items table -->
          <div class="card overflow-hidden mb-6">
            <table class="w-full">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Task Description</th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Hours</th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">WP Number</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (item of editableItems(); track item.id; let i = $index) {
                  <tr [class.bg-slate-50]="i % 2 === 0">
                    <td class="px-4 py-3 text-sm text-slate-700">{{ item.description_clean }}</td>
                    <td class="px-4 py-3 text-sm text-slate-600 text-center">{{ item.hours }}</td>
                    <td class="px-4 py-3 text-center">
                      <input
                        type="text"
                        [(ngModel)]="item.wp_number"
                        [name]="'wp_' + item.id"
                        class="w-full text-center text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="e.g. 3097"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Total row -->
          <div class="flex justify-end mb-6">
            <div class="card px-6 py-3 flex items-center gap-4">
              <span class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total</span>
              <span class="text-2xl font-black text-primary-600">
                {{ getTotalAmount() | number:'1.0-2' }} €
              </span>
            </div>
          </div>

          <!-- Save button -->
          <div class="flex justify-end">
            <button (click)="saveWP()" [disabled]="saving()" class="btn-primary">
              @if (saving()) {
                <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              } @else {
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              }
              Save Work Packages
            </button>
          </div>

          <!-- Footer note -->
          <p class="text-center text-slate-400 text-xs mt-8">
            You can only edit the WP number. Other fields are read-only.
          </p>
        </div>
      }

    </div>
  `,
})
export class ShareComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private shareService = inject(ShareService);

  token = '';
  password = '';

  invoice = signal<SharedInvoice | null>(null);
  editableItems = signal<(SharedItem & { wp_number: string | null })[]>([]);

  loading = signal(false);
  error = signal('');
  saving = signal(false);
  saved = signal(false);
  saveError = signal('');

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
  }

  unlock(): void {
    if (!this.password) return;
    this.loading.set(true);
    this.error.set('');
    this.shareService.accessInvoice(this.token, this.password).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.editableItems.set(inv.items.map((item) => ({ ...item })));
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error || 'Incorrect password or expired link.';
        this.error.set(msg);
        this.loading.set(false);
      },
    });
  }

  saveWP(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set('');

    const items = this.editableItems().map((item) => ({
      id: item.id,
      wp_number: item.wp_number ?? null,
    }));

    this.shareService.updateWP(this.token, this.password, items).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 4000);
      },
      error: (err) => {
        const msg = err?.error?.error || 'Failed to save. Please try again.';
        this.saveError.set(msg);
        this.saving.set(false);
      },
    });
  }

  getTotalAmount(): number {
    return (this.invoice()?.items ?? []).reduce((sum, i) => sum + Number(i.amount), 0);
  }
}
