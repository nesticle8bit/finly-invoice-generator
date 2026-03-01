import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ClientService } from '../../core/services/client.service';
import { ToastService } from '../../core/services/toast.service';
import { Client } from '../../core/models';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass],
  template: `
    <div class="p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Clients</h1>
          <p class="text-slate-500 text-sm mt-0.5">{{ clients().length }} client(s)</p>
        </div>
        <button (click)="openModal()" class="btn-primary">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          New Client
        </button>
      </div>

      <!-- Clients Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (client of clients(); track client.id) {
          <div class="card p-5 group">
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold text-sm">
                {{ client.name[0].toUpperCase() }}
              </div>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button (click)="openModal(client)" class="btn-ghost p-1.5 text-xs">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button (click)="deleteClient(client)" class="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>
            <h3 class="font-bold text-slate-900 text-sm mb-1">{{ client.name }}</h3>
            @if (client.vat) {
              <p class="text-xs text-slate-500 mb-0.5">VAT: {{ client.vat }}</p>
            }
            @if (client.address) {
              <p class="text-xs text-slate-400 leading-relaxed">
                {{ client.address }}<br>
                @if (client.postal_code || client.city) { {{ client.postal_code }} {{ client.city }} }
              </p>
            }
            @if (client.email) {
              <p class="text-xs text-primary-600 mt-2">{{ client.email }}</p>
            }
          </div>
        } @empty {
          <div class="col-span-3 card p-16 text-center text-slate-400">
            <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p class="font-medium">No clients yet</p>
            <button (click)="openModal()" class="text-primary-600 text-sm font-semibold hover:underline mt-1">Add your first client →</button>
          </div>
        }
      </div>
    </div>

    <!-- Modal -->
    @if (showModal()) {
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 class="font-bold text-slate-900">{{ editingClient() ? 'Edit Client' : 'New Client' }}</h2>
            <button (click)="closeModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <form [formGroup]="clientForm" (ngSubmit)="onSave()" class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="label">Company Name *</label>
                <input type="text" formControlName="name" placeholder="Company GmbH" class="input-field">
              </div>
              <div class="col-span-2">
                <label class="label">Address</label>
                <input type="text" formControlName="address" placeholder="Address" class="input-field">
              </div>
              <div>
                <label class="label">Postal Code</label>
                <input type="text" formControlName="postal_code" placeholder="67659" class="input-field">
              </div>
              <div>
                <label class="label">City</label>
                <input type="text" formControlName="city" placeholder="City" class="input-field">
              </div>
              <div>
                <label class="label">Country</label>
                <input type="text" formControlName="country" placeholder="Germany" class="input-field">
              </div>
              <div>
                <label class="label">VAT Number</label>
                <input type="text" formControlName="vat" placeholder="DE100101001" class="input-field">
              </div>
              <div class="col-span-2">
                <label class="label">Email</label>
                <input type="email" formControlName="email" placeholder="billing@company.com" class="input-field">
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" (click)="closeModal()" class="btn-secondary">Cancel</button>
              <button type="submit" [disabled]="clientForm.invalid || saving()" class="btn-primary">
                {{ saving() ? 'Saving...' : (editingClient() ? 'Update Client' : 'Create Client') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class ClientsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clientService = inject(ClientService);
  private toast = inject(ToastService);

  clients = signal<Client[]>([]);
  showModal = signal(false);
  editingClient = signal<Client | null>(null);
  saving = signal(false);

  clientForm = this.fb.group({
    name: ['', Validators.required],
    address: [''],
    city: [''],
    postal_code: [''],
    country: [''],
    vat: [''],
    email: ['', Validators.email],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.clientService.list().subscribe({ next: (c) => this.clients.set(c) });
  }

  openModal(client?: Client): void {
    if (client) {
      this.editingClient.set(client);
      this.clientForm.patchValue(client);
    } else {
      this.editingClient.set(null);
      this.clientForm.reset();
    }
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingClient.set(null);
    this.clientForm.reset();
  }

  onSave(): void {
    if (this.clientForm.invalid || this.saving()) return;
    this.saving.set(true);

    const data = this.clientForm.value as Partial<Client>;
    const editing = this.editingClient();

    const obs = editing
      ? this.clientService.update(editing.id, data)
      : this.clientService.create(data);

    obs.subscribe({
      next: () => {
        this.toast.success(editing ? 'Client updated!' : 'Client created!');
        this.load();
        this.closeModal();
        this.saving.set(false);
      },
      error: () => {
        this.toast.error('Failed to save client');
        this.saving.set(false);
      },
    });
  }

  deleteClient(client: Client): void {
    if (!confirm(`Delete "${client.name}"?`)) return;
    this.clientService.delete(client.id).subscribe({
      next: () => {
        this.toast.success('Client deleted');
        this.load();
      },
      error: () => this.toast.error('Failed to delete client'),
    });
  }
}
