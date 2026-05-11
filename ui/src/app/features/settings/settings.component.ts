import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { InviteService, InviteCode } from '../../core/services/invite.service';
import { Profile } from '../../core/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="p-8 max-w-5xl">

      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-slate-900">Settings</h1>
        <p class="text-slate-500 text-sm mt-0.5">Manage your profile, billing details and assets</p>
      </div>

      @if (loading()) {
        <div class="flex justify-center h-48 items-center">
          <i class="ti ti-loader-2 text-3xl text-primary-600 animate-spin"></i>
        </div>
      } @else {

        <div class="flex gap-6 items-start">

          <!-- LEFT: Vertical tab nav -->
          <nav class="w-52 flex-shrink-0 flex flex-col gap-1">
            @for (tab of visibleTabs(); track tab.id) {
              <button
                (click)="activeTab.set(tab.id)"
                class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 text-left w-full"
                [class.bg-primary-50]="activeTab() === tab.id"
                [class.text-primary-700]="activeTab() === tab.id"
                [class.font-semibold]="activeTab() === tab.id"
                [class.text-slate-500]="activeTab() !== tab.id"
                [class.hover:bg-slate-100]="activeTab() !== tab.id"
                [class.hover:text-slate-700]="activeTab() !== tab.id"
              >
                <i [class]="'ti ' + tab.icon + ' text-lg leading-none'"></i>
                {{ tab.label }}
              </button>
            }
          </nav>

          <!-- RIGHT: Content -->
          <div class="flex-1 min-w-0">
            <form [formGroup]="form" (ngSubmit)="onSave()">

              <!-- Personal Info -->
              @if (activeTab() === 'personal') {
                <div class="card p-6 space-y-5">
                  <div class="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div class="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                      <i class="ti ti-user-circle text-xl text-primary-600"></i>
                    </div>
                    <div>
                      <h2 class="font-semibold text-slate-900 text-sm">Personal Information</h2>
                      <p class="text-slate-400 text-xs">Your name and contact details appear on invoices</p>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="label">Full Name</label>
                      <div class="relative">
                        <i class="ti ti-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
                        <input type="text" formControlName="name" placeholder="Julio Poveda" class="input-field pl-9">
                      </div>
                    </div>
                    <div>
                      <label class="label">Email <span class="text-slate-400 font-normal normal-case text-xs">(read-only)</span></label>
                      <div class="relative">
                        <i class="ti ti-mail absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
                        <input type="email" formControlName="email" class="input-field pl-9 bg-slate-50 text-slate-400 cursor-not-allowed" readonly>
                      </div>
                    </div>
                    <div>
                      <label class="label">VAT / Tax ID</label>
                      <div class="relative">
                        <i class="ti ti-receipt-tax absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
                        <input type="text" formControlName="vat" placeholder="1017205178" class="input-field pl-9">
                      </div>
                    </div>
                    <div>
                      <label class="label">Phone</label>
                      <div class="relative">
                        <i class="ti ti-phone absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
                        <input type="text" formControlName="phone" placeholder="+57 319 249 0106" class="input-field pl-9">
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- Payment -->
              @if (activeTab() === 'payment') {
                <div class="card p-6 space-y-5">
                  <div class="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div class="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <i class="ti ti-credit-card text-xl text-emerald-600"></i>
                    </div>
                    <div>
                      <h2 class="font-semibold text-slate-900 text-sm">Payment Details</h2>
                      <p class="text-slate-400 text-xs">Bank info and rate shown on generated invoices</p>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="label">SWIFT / BIC</label>
                      <div class="relative">
                        <i class="ti ti-building-bank absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
                        <input type="text" formControlName="swift" placeholder="TRWIBEB1XXX" class="input-field pl-9 font-mono uppercase tracking-wider">
                      </div>
                    </div>
                    <div>
                      <label class="label">IBAN</label>
                      <div class="relative">
                        <i class="ti ti-credit-card absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
                        <input type="text" formControlName="iban" placeholder="BE71 9670 3909 1669" class="input-field pl-9 font-mono">
                      </div>
                    </div>
                    <div>
                      <label class="label">Bank Name</label>
                      <div class="relative">
                        <i class="ti ti-building absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
                        <input type="text" formControlName="bank_name" placeholder="Wise" class="input-field pl-9">
                      </div>
                    </div>
                    <div>
                      <label class="label">Default Hourly Rate</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold pointer-events-none">€</span>
                        <input type="number" formControlName="default_rate" placeholder="25" min="0" step="0.5" class="input-field pl-7">
                      </div>
                    </div>
                    <div>
                      <label class="label">Default Currency</label>
                      <div class="relative">
                        <i class="ti ti-currency-euro absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"></i>
                        <select formControlName="currency" class="input-field pl-9">
                          <option value="EUR">EUR — Euro (€)</option>
                          <option value="USD">USD — US Dollar ($)</option>
                          <option value="GBP">GBP — Pound (£)</option>
                          <option value="COP">COP — Colombian Peso</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label class="label">Default Notes Template</label>
                    <textarea formControlName="notes_template" rows="3" placeholder="This invoice is for the total amount of hours worked from ... to ..." class="input-field resize-none"></textarea>
                    <p class="text-xs text-slate-400 mt-1.5">Used as default when creating new invoices.</p>
                  </div>
                </div>
              }

              <!-- Assets -->
              @if (activeTab() === 'assets') {
                <div class="space-y-4">
                  <!-- Logo -->
                  <div class="card p-6">
                    <div class="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
                      <div class="w-9 h-9 rounded-xl bg-accent-500/10 flex items-center justify-center">
                        <i class="ti ti-photo text-xl text-accent-600"></i>
                      </div>
                      <div>
                        <h2 class="font-semibold text-slate-900 text-sm">Invoice Logo</h2>
                        <p class="text-slate-400 text-xs">Appears at the top-left of your invoices</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-6">
                      <div class="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0 transition-colors hover:border-primary-300">
                        @if (logoPreview() || profile()?.logo_path) {
                          <img [src]="logoPreview() || getLogoUrl()" alt="Logo" class="w-full h-full object-contain p-3">
                        } @else {
                          <div class="text-slate-300 text-center">
                            <i class="ti ti-photo-off text-3xl"></i>
                            <p class="text-xs mt-1 text-slate-400">No logo</p>
                          </div>
                        }
                      </div>
                      <div class="flex-1">
                        <p class="text-sm font-medium text-slate-700 mb-1">Upload company logo</p>
                        <p class="text-xs text-slate-400 mb-4">PNG, JPG or SVG · Max 5 MB · Transparent background recommended</p>
                        <label class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer transition-colors shadow-sm">
                          <i class="ti ti-upload text-base"></i>
                          Choose file
                          <input type="file" accept="image/*" class="hidden" (change)="onLogoSelected($event)">
                        </label>
                      </div>
                    </div>
                  </div>

                  <!-- Signature -->
                  <div class="card p-6">
                    <div class="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
                      <div class="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <i class="ti ti-signature text-xl text-indigo-600"></i>
                      </div>
                      <div>
                        <h2 class="font-semibold text-slate-900 text-sm">Signature</h2>
                        <p class="text-slate-400 text-xs">Appears at the bottom of your invoices</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-6">
                      <div class="w-44 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0 transition-colors hover:border-primary-300">
                        @if (signaturePreview() || profile()?.signature_path) {
                          <img [src]="signaturePreview() || getSignatureUrl()" alt="Signature" class="h-full object-contain p-2">
                        } @else {
                          <div class="text-slate-300 text-center">
                            <i class="ti ti-writing-off text-2xl"></i>
                            <p class="text-xs mt-1 text-slate-400">No signature</p>
                          </div>
                        }
                      </div>
                      <div class="flex-1">
                        <p class="text-sm font-medium text-slate-700 mb-1">Upload signature image</p>
                        <p class="text-xs text-slate-400 mb-4">PNG with transparent background recommended</p>
                        <label class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer transition-colors shadow-sm">
                          <i class="ti ti-upload text-base"></i>
                          Choose file
                          <input type="file" accept="image/*" class="hidden" (change)="onSignatureSelected($event)">
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- Save button -->
              @if (activeTab() !== 'assets' && activeTab() !== 'invites') {
                <div class="flex justify-end mt-5">
                  <button type="submit" [disabled]="saving()" class="btn-primary gap-2">
                    @if (saving()) {
                      <i class="ti ti-loader-2 animate-spin text-base"></i>
                      Saving...
                    } @else {
                      <i class="ti ti-check text-base"></i>
                      Save Changes
                    }
                  </button>
                </div>
              }
            </form>

            <!-- Invite Codes -->
            @if (activeTab() === 'invites') {
              <div class="space-y-4">
                <div class="card p-6">
                  <div class="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
                    <div class="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                      <i class="ti ti-ticket text-xl text-amber-600"></i>
                    </div>
                    <div class="flex-1">
                      <h2 class="font-semibold text-slate-900 text-sm">Invitation Codes</h2>
                      <p class="text-slate-400 text-xs">Single-use codes that allow others to register</p>
                    </div>
                    <button (click)="generateCode()" [disabled]="generatingCode()" class="btn-primary gap-2 text-sm py-2">
                      @if (generatingCode()) {
                        <i class="ti ti-loader-2 animate-spin text-base"></i>
                      } @else {
                        <i class="ti ti-plus text-base"></i>
                      }
                      Generate
                    </button>
                  </div>

                  @if (codesLoading()) {
                    <div class="flex justify-center h-20 items-center">
                      <i class="ti ti-loader-2 text-2xl text-primary-600 animate-spin"></i>
                    </div>
                  } @else if (codes().length === 0) {
                    <div class="text-center py-10">
                      <i class="ti ti-ticket-off text-4xl text-slate-300"></i>
                      <p class="text-slate-400 text-sm mt-2">No codes yet. Generate one to get started.</p>
                    </div>
                  } @else {
                    <div class="divide-y divide-slate-100">
                      @for (code of codes(); track code.id) {
                        <div class="flex items-center justify-between py-3">
                          <div class="flex items-center gap-3">
                            <span class="font-mono text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg tracking-wider">{{ code.code }}</span>
                            @if (!code.used_at) {
                              <button (click)="copyCode(code.code)" class="text-slate-400 hover:text-primary-600 transition-colors" title="Copy">
                                <i class="ti ti-copy text-base"></i>
                              </button>
                            }
                          </div>
                          <div class="flex items-center gap-4">
                            @if (code.used_by_name) {
                              <div class="text-right">
                                <p class="text-xs font-medium text-slate-700">{{ code.used_by_name }}</p>
                                <p class="text-xs text-slate-400">{{ code.used_by_email }}</p>
                              </div>
                            }
                            @if (code.used_at) {
                              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                                <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Used
                              </span>
                            } @else {
                              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Available
                              </span>
                            }
                            <span class="text-xs text-slate-400 w-20 text-right">{{ code.created_at | date:'MMM d, y' }}</span>
                            @if (!code.used_at) {
                              <button (click)="deleteCode(code.id)" class="text-slate-300 hover:text-red-500 transition-colors">
                                <i class="ti ti-trash text-base"></i>
                              </button>
                            } @else {
                              <span class="w-5"></span>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            }

          </div>
        </div>
      }
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private profileService = inject(ProfileService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private inviteService = inject(InviteService);

  profile = signal<Profile | null>(null);
  loading = signal(true);
  saving = signal(false);
  activeTab = signal('personal');
  logoPreview = signal<string>('');
  signaturePreview = signal<string>('');

  // Invite codes
  codes = signal<InviteCode[]>([]);
  codesLoading = signal(false);
  generatingCode = signal(false);

  isAdmin = () => this.auth.currentUser()?.id === 1;

  allTabs = [
    { id: 'personal', label: 'Personal',        icon: 'ti-user-circle'  },
    { id: 'payment',  label: 'Payment',          icon: 'ti-credit-card'  },
    { id: 'assets',   label: 'Logo & Signature', icon: 'ti-photo'        },
    { id: 'invites',  label: 'Invite Codes',     icon: 'ti-ticket'       },
  ];

  visibleTabs = () => this.allTabs.filter(t => t.id !== 'invites' || this.isAdmin());

  form = this.fb.group({
    name: [''],
    email: [{ value: '', disabled: true }],
    vat: [''],
    phone: [''],
    swift: [''],
    iban: [''],
    bank_name: [''],
    default_rate: [25],
    currency: ['EUR'],
    notes_template: [''],
  });

  ngOnInit(): void {
    this.profileService.get().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.form.patchValue({
          name: p.name,
          email: p.email,
          vat: p.vat,
          phone: p.phone,
          swift: p.swift,
          iban: p.iban,
          bank_name: p.bank_name,
          default_rate: p.default_rate || 25,
          currency: p.currency || 'EUR',
          notes_template: p.notes_template,
        });
        this.loading.set(false);
        if (this.isAdmin()) this.loadCodes();
      },
      error: () => this.loading.set(false),
    });
  }

  loadCodes(): void {
    this.codesLoading.set(true);
    this.inviteService.list().subscribe({
      next: (list) => { this.codes.set(list); this.codesLoading.set(false); },
      error: () => this.codesLoading.set(false),
    });
  }

  generateCode(): void {
    this.generatingCode.set(true);
    this.inviteService.create().subscribe({
      next: (code) => {
        this.codes.update((list) => [code, ...list]);
        this.generatingCode.set(false);
        this.toast.success(`Code ${code.code} created!`);
      },
      error: () => {
        this.toast.error('Failed to generate code');
        this.generatingCode.set(false);
      },
    });
  }

  deleteCode(id: number): void {
    this.inviteService.delete(id).subscribe({
      next: () => {
        this.codes.update((list) => list.filter((c) => c.id !== id));
        this.toast.success('Code deleted');
      },
      error: () => this.toast.error('Failed to delete code'),
    });
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => this.toast.success(`Copied: ${code}`));
  }

  getLogoUrl(): string {
    const p = this.profile();
    return p?.logo_path ? `${environment.uploadsUrl}/${p.logo_path}` : '';
  }

  getSignatureUrl(): string {
    const p = this.profile();
    return p?.signature_path ? `${environment.uploadsUrl}/${p.signature_path}` : '';
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => this.logoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
    this.profileService.uploadLogo(file).subscribe({
      next: (res) => {
        this.profile.update((p) => p ? { ...p, logo_path: res.logo_path } : p);
        this.toast.success('Logo uploaded!');
      },
      error: () => this.toast.error('Failed to upload logo'),
    });
  }

  onSignatureSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => this.signaturePreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
    this.profileService.uploadSignature(file).subscribe({
      next: (res) => {
        this.profile.update((p) => p ? { ...p, signature_path: res.signature_path } : p);
        this.toast.success('Signature uploaded!');
      },
      error: () => this.toast.error('Failed to upload signature'),
    });
  }

  onSave(): void {
    if (this.saving()) return;
    this.saving.set(true);
    const value = this.form.getRawValue() as Partial<Profile>;
    this.profileService.update(value).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.toast.success('Settings saved!');
        this.saving.set(false);
      },
      error: () => {
        this.toast.error('Failed to save settings');
        this.saving.set(false);
      },
    });
  }
}
