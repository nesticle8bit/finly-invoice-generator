import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, NgClass } from '@angular/common';
import { InvoiceService } from '../../../core/services/invoice.service';
import { ClientService } from '../../../core/services/client.service';
import { ProfileService } from '../../../core/services/profile.service';
import { ToastService } from '../../../core/services/toast.service';
import { Client, Profile } from '../../../core/models';

@Component({
  selector: 'app-invoice-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgClass, DecimalPipe],
  template: `
    <div class="p-8 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-8">
        <a routerLink="/invoices" class="btn-ghost p-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ isEdit() ? 'Edit Invoice' : 'New Invoice' }}</h1>
          <p class="text-slate-500 text-sm mt-0.5">{{ isEdit() ? 'Update invoice details' : 'Create a new invoice' }}</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <!-- Invoice Meta -->
        <div class="card p-6 mb-5">
          <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Invoice Details</h2>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Invoice Number</label>
              <input type="text" formControlName="invoice_number" class="input-field font-mono" placeholder="0078">
            </div>
            <div>
              <label class="label">Date</label>
              <input type="date" formControlName="date" class="input-field">
            </div>
            <div>
              <label class="label">Client</label>
              <select formControlName="client_id" class="input-field">
                <option value="">— Select client —</option>
                @for (c of clients(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            <div>
              <label class="label">Status</label>
              <select formControlName="status" class="input-field">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Period (for notes) -->
        <div class="card p-6 mb-5">
          <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Work Period</h2>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Period Start</label>
              <input type="date" formControlName="period_start" class="input-field">
            </div>
            <div>
              <label class="label">Period End</label>
              <input type="date" formControlName="period_end" class="input-field">
            </div>
          </div>
        </div>

        <!-- Items -->
        <div class="card p-6 mb-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Task Items</h2>
            <button type="button" (click)="addItem()" class="btn-secondary text-xs py-1.5 px-3">
              + Add Item
            </button>
          </div>

          <!-- Table header -->
          <div class="grid grid-cols-12 gap-2 mb-2 px-1">
            <div class="col-span-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</div>
            <div class="col-span-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Hours</div>
            <div class="col-span-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Rate (€)</div>
            <div class="col-span-1 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</div>
            <div class="col-span-1"></div>
          </div>

          <div formArrayName="items" class="space-y-2">
            @for (item of itemsArray.controls; track $index; let i = $index) {
              <div [formGroupName]="i" class="grid grid-cols-12 gap-2 items-start group">
                <div class="col-span-6">
                  <input
                    type="text"
                    formControlName="description"
                    placeholder="Task description"
                    class="input-field text-xs py-2"
                  >
                </div>
                <div class="col-span-2">
                  <input
                    type="number"
                    formControlName="hours"
                    placeholder="0"
                    min="0"
                    step="0.5"
                    (input)="recalcItem(i)"
                    class="input-field text-xs py-2 text-center"
                  >
                </div>
                <div class="col-span-2">
                  <input
                    type="number"
                    formControlName="rate"
                    placeholder="25"
                    min="0"
                    step="0.5"
                    (input)="recalcItem(i)"
                    class="input-field text-xs py-2 text-center"
                  >
                </div>
                <div class="col-span-1 flex items-center justify-end h-[38px]">
                  <span class="text-sm font-semibold text-slate-700">
                    €{{ getItemAmount(i) | number:'1.0-2' }}
                  </span>
                </div>
                <div class="col-span-1 flex items-center justify-center h-[38px]">
                  <button
                    type="button"
                    (click)="removeItem(i)"
                    class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1 rounded"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Total -->
          <div class="mt-4 pt-4 border-t border-slate-100 flex justify-end">
            <div class="flex items-center gap-4">
              <span class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total</span>
              <span class="text-2xl font-bold text-primary-600">€{{ getTotal() | number:'1.0-2' }}</span>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="card p-6 mb-6">
          <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Notes</h2>
          <textarea
            formControlName="notes"
            rows="3"
            placeholder="Invoice notes..."
            class="input-field resize-none"
          ></textarea>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-3">
          <a routerLink="/invoices" class="btn-secondary">Cancel</a>
          <button
            type="submit"
            [disabled]="form.invalid || saving()"
            class="btn-primary"
          >
            @if (saving()) { Saving... } @else { {{ isEdit() ? 'Update Invoice' : 'Create Invoice' }} }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class InvoiceEditorComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private invoiceService = inject(InvoiceService);
  private clientService = inject(ClientService);
  private profileService = inject(ProfileService);
  private toast = inject(ToastService);

  clients = signal<Client[]>([]);
  profile = signal<Profile | null>(null);
  isEdit = signal(false);
  saving = signal(false);
  invoiceId: number | null = null;

  form: FormGroup = this.fb.group({
    invoice_number: ['', Validators.required],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    client_id: [''],
    status: ['draft'],
    period_start: [''],
    period_end: [''],
    notes: [''],
    items: this.fb.array([]),
  });

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  ngOnInit(): void {
    this.loadClients();
    this.loadProfile();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.invoiceId = parseInt(id);
      this.loadInvoice(this.invoiceId);
    } else {
      this.loadNextNumber();
      this.addItem();
    }
  }

  loadClients(): void {
    this.clientService.list().subscribe({ next: (c) => this.clients.set(c) });
  }

  loadProfile(): void {
    this.profileService.get().subscribe({ next: (p) => this.profile.set(p) });
  }

  loadNextNumber(): void {
    this.invoiceService.getNextNumber().subscribe({
      next: (r) => this.form.patchValue({ invoice_number: r.number }),
    });
  }

  loadInvoice(id: number): void {
    this.invoiceService.getById(id).subscribe({
      next: (inv) => {
        this.form.patchValue({
          invoice_number: inv.invoice_number,
          date: inv.date?.split('T')[0] || inv.date,
          client_id: inv.client_id || '',
          status: inv.status,
          period_start: inv.period_start?.split('T')[0] || '',
          period_end: inv.period_end?.split('T')[0] || '',
          notes: inv.notes,
        });
        // Add items
        this.itemsArray.clear();
        inv.items.forEach((item) => {
          this.itemsArray.push(this.createItemGroup(item.description, item.hours, item.rate));
        });
      },
      error: () => {
        this.toast.error('Invoice not found');
        this.router.navigate(['/invoices']);
      },
    });
  }

  createItemGroup(description = '', hours = 0, rate = 0): FormGroup {
    return this.fb.group({
      description: [description, Validators.required],
      hours: [hours, [Validators.required, Validators.min(0)]],
      rate: [rate || this.profile()?.default_rate || 25, [Validators.required, Validators.min(0)]],
    });
  }

  addItem(): void {
    const defaultRate = this.profile()?.default_rate || 25;
    this.itemsArray.push(this.createItemGroup('', 0, defaultRate));
  }

  removeItem(index: number): void {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  recalcItem(_index: number): void {
    // Triggered on input to force change detection
  }

  getItemAmount(index: number): number {
    const item = this.itemsArray.at(index).value;
    return (item.hours || 0) * (item.rate || 0);
  }

  getTotal(): number {
    return this.itemsArray.controls.reduce((sum, ctrl) => {
      const v = ctrl.value;
      return sum + (v.hours || 0) * (v.rate || 0);
    }, 0);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const value = this.form.getRawValue();
    const payload = {
      ...value,
      client_id: value.client_id || null,
      items: (value.items ?? []).map((item: any) => ({
        description: item.description ?? '',
        hours: item.hours ?? 0,
        rate: item.rate ?? 0,
        amount: (item.hours ?? 0) * (item.rate ?? 0),
      })),
    };

    const obs = this.isEdit() && this.invoiceId
      ? this.invoiceService.update(this.invoiceId, payload)
      : this.invoiceService.create(payload);

    obs.subscribe({
      next: (inv) => {
        this.toast.success(this.isEdit() ? 'Invoice updated!' : 'Invoice created!');
        this.router.navigate(['/invoices', inv.id, 'preview']);
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Failed to save invoice');
        this.saving.set(false);
      },
    });
  }
}
