import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './settings.component.html',
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
