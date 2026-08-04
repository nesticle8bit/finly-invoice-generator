import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from "@angular/router";
import { DatePipe, CurrencyPipe, DecimalPipe, NgClass } from "@angular/common";
import { MoneyPipe } from "../../shared/money/money.pipe";
import { InvoiceService } from "../../core/services/invoice.service";
import { DashboardStats, MonthStat } from "../../core/models";

@Component({
  selector: "app-dashboard",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, NgClass, MoneyPipe],
  providers: [CurrencyPipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private invoiceService = inject(InvoiceService);

  stats = signal<DashboardStats | null>(null);
  monthlyStats = signal<MonthStat[]>([]);
  loading = signal(true);
  today = new Date();

  maxMonthRevenue(): number {
    return Math.max(...this.monthlyStats().map(m => +m.revenue), 1);
  }

  monthDelta(): number | null {
    const s = this.stats();
    if (!s || +s.last_month_revenue === 0) return null;
    return Math.round(((+s.month_revenue - +s.last_month_revenue) / +s.last_month_revenue) * 100);
  }

  ngOnInit(): void {
    this.invoiceService.getStats().subscribe({
      next: (s) => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.invoiceService.getMonthlyStats().subscribe({
      next: (m) => this.monthlyStats.set(m),
    });
  }
}
