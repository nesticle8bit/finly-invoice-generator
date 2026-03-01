import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';
import { Profile } from '../../core/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass],
  template: `
    <div class="p-8 max-w-3xl mx-auto">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-slate-900">Settings</h1>
        <p class="text-slate-500 text-sm mt-0.5">Customize your profile and invoice defaults</p>
      </div>

      @if (loading()) {
        <div class="flex justify-center h-32 items-center">
          <div class="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      } @else {
        <!-- Tabs -->
        <div class="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
          @for (tab of tabs; track tab.id) {
            <button
              (click)="activeTab.set(tab.id)"
              class="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
              [class.bg-white]="activeTab() === tab.id"
              [class.text-slate-900]="activeTab() === tab.id"
              [class.shadow-sm]="activeTab() === tab.id"
              [class.text-slate-500]="activeTab() !== tab.id"
            >{{ tab.label }}</button>
          }
        </div>

        <form [formGroup]="form" (ngSubmit)="onSave()">

          <!-- Personal Info Tab -->
          @if (activeTab() === 'personal') {
            <div class="card p-6 mb-4 space-y-4 animate-fade-in">
              <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Personal Information</h2>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="label">Full Name</label>
                  <input type="text" formControlName="name" placeholder="Julio Poveda" class="input-field">
                </div>
                <div>
                  <label class="label">Email</label>
                  <input type="email" formControlName="email" class="input-field bg-slate-50" readonly>
                </div>
                <div>
                  <label class="label">VAT / Tax ID</label>
                  <input type="text" formControlName="vat" placeholder="1017205178" class="input-field">
                </div>
                <div>
                  <label class="label">Phone</label>
                  <input type="text" formControlName="phone" placeholder="+57 319 249 0106" class="input-field">
                </div>
              </div>
            </div>
          }

          <!-- Payment Tab -->
          @if (activeTab() === 'payment') {
            <div class="card p-6 mb-4 space-y-4 animate-fade-in">
              <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Payment Details</h2>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="label">SWIFT / BIC</label>
                  <input type="text" formControlName="swift" placeholder="TRWIBEB1XXX" class="input-field font-mono">
                </div>
                <div>
                  <label class="label">IBAN</label>
                  <input type="text" formControlName="iban" placeholder="BE71 9670 3909 1669" class="input-field font-mono">
                </div>
                <div>
                  <label class="label">Bank Name</label>
                  <input type="text" formControlName="bank_name" placeholder="Wise" class="input-field">
                </div>
                <div>
                  <label class="label">Default Rate (per hour)</label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">€</span>
                    <input type="number" formControlName="default_rate" placeholder="25" min="0" step="0.5" class="input-field pl-7">
                  </div>
                </div>
                <div>
                  <label class="label">Currency</label>
                  <select formControlName="currency" class="input-field">
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="COP">COP</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="label">Default Notes Template</label>
                <textarea formControlName="notes_template" rows="3" placeholder="This invoice is for the total amount of hours worked from ... to ..." class="input-field resize-none"></textarea>
              </div>
            </div>
          }

          <!-- Assets Tab -->
          @if (activeTab() === 'assets') {
            <div class="space-y-4 animate-fade-in">
              <!-- Logo -->
              <div class="card p-6">
                <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Invoice Logo</h2>
                <div class="flex items-center gap-6">
                  <div class="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
                    @if (logoPreview() || profile()?.logo_path) {
                      <img [src]="logoPreview() || getLogoUrl()" alt="Logo" class="w-full h-full object-contain p-2">
                    } @else {
                      <div class="text-slate-400 text-center">
                        <svg class="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <p class="text-xs mt-1">No logo</p>
                      </div>
                    }
                  </div>
                  <div>
                    <p class="text-sm text-slate-700 font-medium mb-1">Upload your logo</p>
                    <p class="text-xs text-slate-500 mb-3">PNG, JPG or SVG. Max 5MB. Recommended: transparent background.</p>
                    <label class="btn-secondary cursor-pointer text-xs py-2">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                      </svg>
                      Choose File
                      <input type="file" accept="image/*" class="hidden" (change)="onLogoSelected($event)">
                    </label>
                  </div>
                </div>
              </div>

              <!-- Signature -->
              <div class="card p-6">
                <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Signature</h2>
                <div class="flex items-center gap-6">
                  <div class="w-40 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
                    @if (signaturePreview() || profile()?.signature_path) {
                      <img [src]="signaturePreview() || getSignatureUrl()" alt="Signature" class="h-full object-contain p-2">
                    } @else {
                      <div class="text-slate-400 text-center">
                        <p class="text-xs">No signature</p>
                      </div>
                    }
                  </div>
                  <div>
                    <p class="text-sm text-slate-700 font-medium mb-1">Upload your signature</p>
                    <p class="text-xs text-slate-500 mb-3">PNG with transparent background recommended.</p>
                    <label class="btn-secondary cursor-pointer text-xs py-2">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                      </svg>
                      Choose File
                      <input type="file" accept="image/*" class="hidden" (change)="onSignatureSelected($event)">
                    </label>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Save Button (not for assets tab) -->
          @if (activeTab() !== 'assets') {
            <div class="flex justify-end mt-4">
              <button type="submit" [disabled]="saving()" class="btn-primary">
                {{ saving() ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          }
        </form>
      }
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private profileService = inject(ProfileService);
  private toast = inject(ToastService);

  profile = signal<Profile | null>(null);
  loading = signal(true);
  saving = signal(false);
  activeTab = signal('personal');
  logoPreview = signal<string>('');
  signaturePreview = signal<string>('');

  tabs = [
    { id: 'personal', label: 'Personal' },
    { id: 'payment', label: 'Payment' },
    { id: 'assets', label: 'Logo & Signature' },
  ];

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
      },
      error: () => this.loading.set(false),
    });
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
