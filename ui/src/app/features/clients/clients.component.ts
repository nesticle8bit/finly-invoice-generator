import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from "@angular/forms";
import { NgClass, DatePipe, DecimalPipe } from "@angular/common";
import { ClientService } from "../../core/services/client.service";
import { InvoiceService } from "../../core/services/invoice.service";
import { ToastService } from "../../core/services/toast.service";
import { Client, Invoice } from "../../core/models";
import { ConfirmService } from "../../shared/confirm/confirm.service";

@Component({
  selector: "app-clients",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgClass, DatePipe, DecimalPipe],
  templateUrl: './clients.component.html',
})
export class ClientsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clientService = inject(ClientService);
  private invoiceService = inject(InvoiceService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);

  clients = signal<Client[]>([]);
  showModal = signal(false);
  editingClient = signal<Client | null>(null);
  saving = signal(false);
  outstandingMap = signal<Record<number, number>>({});

  historyClient = signal<Client | null>(null);
  clientInvoices = signal<Invoice[]>([]);
  historyLoading = signal(false);

  totalBilled(): number {
    return this.clientInvoices().reduce((s, i) => s + i.total, 0);
  }

  totalOutstanding(): number {
    return this.clientInvoices().filter(i => i.status === 'sent').reduce((s, i) => s + i.total, 0);
  }

  openHistory(client: Client): void {
    this.historyClient.set(client);
    this.historyLoading.set(true);
    this.clientInvoices.set([]);
    this.invoiceService.list({ client_id: client.id }).subscribe({
      next: (res) => { this.clientInvoices.set(res.data); this.historyLoading.set(false); },
      error: () => this.historyLoading.set(false),
    });
  }

  closeHistory(): void {
    this.historyClient.set(null);
    this.clientInvoices.set([]);
  }

  clientForm = this.fb.group({
    name: ["", Validators.required],
    address: [""],
    city: [""],
    postal_code: [""],
    country: [""],
    vat: [""],
    email: ["", Validators.email],
    currency: [""],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.clientService.list().subscribe({
      next: (c) => {
        this.clients.set(c);
        this.loadOutstanding(c);
      }
    });
  }

  private loadOutstanding(clients: Client[]): void {
    const map: Record<number, number> = {};
    let pending = clients.length;
    if (!pending) return;
    for (const client of clients) {
      this.invoiceService.list({ client_id: client.id, status: 'sent' }).subscribe({
        next: (res) => {
          const total = res.data.reduce((s, i) => s + i.total, 0);
          if (total > 0) map[client.id] = total;
          if (--pending === 0) this.outstandingMap.set({ ...map });
        },
        error: () => { if (--pending === 0) this.outstandingMap.set({ ...map }); },
      });
    }
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

    const obs = editing ? this.clientService.update(editing.id, data) : this.clientService.create(data);

    obs.subscribe({
      next: () => {
        this.toast.success(editing ? "Client updated!" : "Client created!");
        this.load();
        this.closeModal();
        this.saving.set(false);
      },
      error: () => {
        this.toast.error("Failed to save client");
        this.saving.set(false);
      },
    });
  }

  async deleteClient(client: Client): Promise<void> {
    const confirmed = await this.confirmService.ask({
      title: 'Delete client',
      message: `"${client.name}" will be removed. Invoices already issued keep their data.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.clientService.delete(client.id).subscribe({
      next: () => {
        this.toast.success("Client deleted");
        this.load();
      },
      error: () => this.toast.error("Failed to delete client"),
    });
  }
}
