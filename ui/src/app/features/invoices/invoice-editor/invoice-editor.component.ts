import { ChangeDetectionStrategy, Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CurrencyPipe } from "@angular/common";
import { MoneyPipe } from "../../../shared/money/money.pipe";
import { FormsModule } from "@angular/forms";
import { InvoiceService } from "../../../core/services/invoice.service";
import { ClientService } from "../../../core/services/client.service";
import { ProfileService } from "../../../core/services/profile.service";
import { ToastService } from "../../../core/services/toast.service";
import { Client, InvoiceInput, InvoiceItemInput, Profile } from "../../../core/models";
import { lineAmount, sumLineAmounts } from "../../../core/utils/money";
import { merge } from "rxjs";

@Component({
  selector: "app-invoice-editor",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, MoneyPipe],
  providers: [CurrencyPipe],
  templateUrl: './invoice-editor.component.html',
})
export class InvoiceEditorComponent implements OnInit, OnDestroy {
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
  autosaved = signal(false);
  showImportModal = signal(false);
  importText = '';
  invoiceId: number | null = null;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private autosaveHideTimer: ReturnType<typeof setTimeout> | null = null;

  form: FormGroup = this.fb.group({
    invoice_number: ["", Validators.required],
    date: [new Date().toISOString().split("T")[0], Validators.required],
    due_date: [""],
    client_id: [""],
    status: ["draft"],
    period_start: [""],
    period_end: [""],
    notes: [""],
    is_template: [false],
    items: this.fb.array([]),
  });

  get itemsArray(): FormArray {
    return this.form.get("items") as FormArray;
  }

  ngOnInit(): void {
    this.loadClients();
    this.loadProfile();
    this.watchPeriod();

    const id = this.route.snapshot.paramMap.get("id");
    if (id) {
      this.isEdit.set(true);
      this.invoiceId = parseInt(id);
      this.loadInvoice(this.invoiceId);
    } else {
      this.loadNextNumber();
      this.addItem();
    }
  }

  private watchPeriod(): void {
    merge(this.form.get("period_start")!.valueChanges, this.form.get("period_end")!.valueChanges).subscribe(() => {
      const { period_start, period_end } = this.form.value;
      if (!period_start || !period_end) return;
      const fmt = (d: string) => {
        const [y, m, day] = d.split("-");
        return `${day}.${m}.${y}`;
      };
      this.form.patchValue({ notes: `This invoice is for the total amount of hours worked from ${fmt(period_start)} to ${fmt(period_end)}` }, { emitEvent: false });
    });
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
          date: inv.date?.split("T")[0] || inv.date,
          due_date: inv.due_date?.split("T")[0] || "",
          client_id: inv.client_id || "",
          status: inv.status,
          period_start: inv.period_start?.split("T")[0] || "",
          period_end: inv.period_end?.split("T")[0] || "",
          notes: inv.notes,
          is_template: inv.is_template ?? false,
        });
        // Add items
        this.itemsArray.clear();
        inv.items.forEach((item) => {
          this.itemsArray.push(this.createItemGroup(item.description, item.hours, item.rate));
        });
        // Mark pristine so initial load doesn't trigger autosave
        this.form.markAsPristine();
        this.startAutosave();
      },
      error: () => {
        this.toast.error("Invoice not found");
        this.router.navigate(["/invoices"]);
      },
    });
  }

  private startAutosave(): void {
    this.autosaveTimer = setInterval(() => {
      if (this.form.dirty && !this.saving() && this.invoiceId) {
        this.performAutosave();
      }
    }, 30_000);
  }

  /** Turns the raw form value into the API payload, with amounts recomputed. */
  private buildPayload(): InvoiceInput {
    const value = this.form.getRawValue();
    const items = (value.items ?? []) as Partial<InvoiceItemInput>[];

    return {
      ...value,
      client_id: value.client_id || null,
      // An empty date input is '', which the API reads as an invalid date.
      due_date: value.due_date || null,
      items: items.map((item) => {
        const hours = item.hours ?? 0;
        const rate = item.rate ?? 0;
        return { description: item.description ?? "", hours, rate, amount: lineAmount(hours, rate) };
      }),
    };
  }

  private performAutosave(): void {
    this.invoiceService.update(this.invoiceId!, this.buildPayload()).subscribe({
      next: () => {
        this.form.markAsPristine();
        this.autosaved.set(true);
        if (this.autosaveHideTimer) clearTimeout(this.autosaveHideTimer);
        this.autosaveHideTimer = setTimeout(() => this.autosaved.set(false), 3000);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    if (this.autosaveHideTimer) clearTimeout(this.autosaveHideTimer);
  }

  /** Consumed by unsavedChangesGuard — autosave only runs every 30 seconds. */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  /** Ctrl/Cmd+Enter saves, Ctrl/Cmd+I adds an item — this form is filled in bulk. */
  @HostListener('document:keydown', ['$event'])
  onShortcut(event: KeyboardEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;

    const key = event.key.toLowerCase();
    if (key === 'enter') {
      event.preventDefault();
      this.onSubmit();
    } else if (key === 'i') {
      event.preventDefault();
      this.addItem();
      this.focusLastItem();
    }
  }

  private focusLastItem(): void {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('[formarrayname="items"] input[formcontrolname="description"]');
      inputs[inputs.length - 1]?.focus();
    });
  }

  /** Enter on the last description field appends a row instead of submitting. */
  onDescriptionEnter(index: number, event: Event): void {
    event.preventDefault();
    if (index === this.itemsArray.length - 1) this.addItem();
    this.focusLastItem();
  }

  createItemGroup(description = "", hours = 0, rate = 0): FormGroup {
    return this.fb.group({
      description: [description, Validators.required],
      hours: [hours, [Validators.required, Validators.min(0)]],
      rate: [rate || this.profile()?.default_rate || 25, [Validators.required, Validators.min(0)]],
    });
  }

  addItem(): void {
    const defaultRate = this.profile()?.default_rate || 25;
    this.itemsArray.push(this.createItemGroup("", 0, defaultRate));
  }

  removeItem(index: number): void {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  recalcItem(): void {
    // Triggered on input to force change detection
  }

  getItemAmount(index: number): number {
    const item = this.itemsArray.at(index).value;
    return lineAmount(item.hours, item.rate);
  }

  getTotal(): number {
    return sumLineAmounts(
      this.itemsArray.controls.map((ctrl) => ({ hours: ctrl.value.hours || 0, rate: ctrl.value.rate || 0 }))
    );
  }

  importTasks(): void {
    const defaultRate = this.profile()?.default_rate || 25;
    const lines = this.importText.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      const description = parts[0] || '';
      const hours = parseFloat(parts[1] || '0') || 0;
      const rate = parseFloat(parts[2] || '') || defaultRate;
      if (description) this.itemsArray.push(this.createItemGroup(description, hours, rate));
    }
    this.importText = '';
    this.showImportModal.set(false);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const payload = this.buildPayload();
    const obs = this.isEdit() && this.invoiceId ? this.invoiceService.update(this.invoiceId, payload) : this.invoiceService.create(payload);

    obs.subscribe({
      next: (inv) => {
        this.toast.success(this.isEdit() ? "Invoice updated!" : "Invoice created!");
        this.router.navigate(["/invoices", inv.id, "preview"]);
      },
      error: (err) => {
        this.toast.error(err.error?.error || "Failed to save invoice");
        this.saving.set(false);
      },
    });
  }
}
