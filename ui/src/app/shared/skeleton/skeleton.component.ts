import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Placeholder that keeps the page's shape while data loads. A centred spinner
 * collapsed the layout and made the content jump once it arrived.
 */
@Component({
  selector: 'app-skeleton-rows',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="animate-pulse" aria-hidden="true">
      @for (row of rows; track $index) {
        <div class="flex items-center gap-4 px-4 py-3.5 sm:px-6 border-b border-slate-50 last:border-0">
          @for (col of columns; track $index) {
            <div class="h-3 rounded bg-slate-100" [style.width.%]="col"></div>
          }
        </div>
      }
    </div>
    <span class="sr-only" role="status">Loading…</span>
  `,
})
export class SkeletonRowsComponent {
  /** Relative widths of each placeholder bar, as percentages of the row. */
  @Input() columns: number[] = [12, 26, 16, 12, 14, 10];

  @Input() set count(value: number) {
    this.rows = Array.from({ length: value });
  }

  rows: unknown[] = Array.from({ length: 6 });
}
