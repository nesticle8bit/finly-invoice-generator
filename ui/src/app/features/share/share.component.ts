import { ChangeDetectionStrategy, Component, HostListener, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, groupBy, mergeMap, takeUntil } from 'rxjs';
import { ShareService, SharedInvoice, SharedItem } from '../../core/services/share.service';

type RowStatus = 'pending' | 'saving' | 'saved' | 'error';

const WP_PATTERN = /^\d+$/;

@Component({
  selector: 'app-share',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './share.component.html',
})
export class ShareComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private shareService = inject(ShareService);

  token = '';
  password = '';

  invoice = signal<SharedInvoice | null>(null);
  editableItems = signal<(SharedItem & { wp_number: string | null })[]>([]);

  loading = signal(false);
  error = signal('');
  sessionExpired = signal(false);

  /** Per-row autosave state, keyed by item id. */
  rowStatus = signal<Record<number, RowStatus | undefined>>({});
  /** Per-row message shown instead of the status line (validation errors). */
  rowError = signal<Record<number, string | undefined>>({});

  globalStatus = computed<'idle' | 'saving' | 'error' | 'clean'>(() => {
    const statuses = Object.values(this.rowStatus());
    if (statuses.some((s) => s === 'saving' || s === 'pending')) return 'saving';
    if (statuses.some((s) => s === 'error')) return 'error';
    if (statuses.some((s) => s === 'saved')) return 'clean';
    return 'idle';
  });

  private sessionToken = '';
  private wpChange$ = new Subject<number>();
  private destroy$ = new Subject<void>();
  /** Last value persisted per item id — avoids saving when nothing changed. */
  private lastSaved = new Map<number, string | null>();
  private savedTimers = new Map<number, ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';

    // Debounce per row: editing row B must never cancel a pending save for row A.
    this.wpChange$
      .pipe(
        groupBy((id) => id),
        mergeMap((group) => group.pipe(debounceTime(700))),
        takeUntil(this.destroy$)
      )
      .subscribe((id) => this.saveRow(id));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.savedTimers.forEach((t) => clearTimeout(t));
  }

  /** Warn before leaving while an autosave is still in flight or queued. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    const statuses = Object.values(this.rowStatus());
    if (statuses.some((s) => s === 'pending' || s === 'saving' || s === 'error')) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  unlock(): void {
    if (!this.password) return;
    this.loading.set(true);
    this.error.set('');
    this.shareService.accessInvoice(this.token, this.password).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.sessionToken = inv.session_token;
        this.editableItems.set(inv.items.map((item) => ({ ...item })));
        this.lastSaved.clear();
        inv.items.forEach((item) => this.lastSaved.set(item.id, this.normalize(item.wp_number)));
        this.loading.set(false);
        this.password = '';
        this.focusFirstEmpty();
      },
      error: (err) => {
        const msg = err?.error?.error || 'Incorrect password or expired link.';
        this.error.set(msg);
        this.loading.set(false);
      },
    });
  }

  onWpChange(itemId: number): void {
    this.setRowStatus(itemId, 'pending');
    this.wpChange$.next(itemId);
  }

  /** Save immediately (blur / Enter) instead of waiting for the debounce. */
  flushWp(itemId: number): void {
    this.saveRow(itemId);
  }

  isRowInvalid(itemId: number): boolean {
    return !!this.rowError()[itemId] || this.rowStatus()[itemId] === 'error';
  }

  saveRow(itemId: number): void {
    const item = this.editableItems().find((i) => i.id === itemId);
    if (!item) return;

    const value = this.normalize(item.wp_number);

    if (value !== null && !WP_PATTERN.test(value)) {
      this.setRowError(itemId, 'Digits only');
      this.setRowStatus(itemId, undefined);
      return;
    }
    this.setRowError(itemId, undefined);

    if (this.lastSaved.get(itemId) === value) {
      if (this.rowStatus()[itemId] === 'pending') this.setRowStatus(itemId, undefined);
      return;
    }

    if (this.sessionExpired()) return;

    this.setRowStatus(itemId, 'saving');

    this.shareService.updateWP(this.token, this.sessionToken, [{ id: itemId, wp_number: value }]).subscribe({
      next: () => {
        this.lastSaved.set(itemId, value);
        this.setRowStatus(itemId, 'saved');
        const timer = setTimeout(() => this.clearIfStill(itemId, 'saved'), 2500);
        this.savedTimers.set(itemId, timer);
      },
      error: (err) => {
        if (err?.status === 401) this.sessionExpired.set(true);
        this.setRowStatus(itemId, 'error');
      },
    });
  }

  private normalize(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
  }

  private clearIfStill(itemId: number, expected: RowStatus): void {
    if (this.rowStatus()[itemId] === expected) this.setRowStatus(itemId, undefined);
  }

  private setRowStatus(itemId: number, status: RowStatus | undefined): void {
    const existing = this.savedTimers.get(itemId);
    if (existing) {
      clearTimeout(existing);
      this.savedTimers.delete(itemId);
    }
    this.rowStatus.update((map) => ({ ...map, [itemId]: status }));
  }

  private setRowError(itemId: number, message: string | undefined): void {
    this.rowError.update((map) => ({ ...map, [itemId]: message }));
  }

  /** Jump straight to the first row still missing a WP — this view is bulk data entry. */
  private focusFirstEmpty(): void {
    setTimeout(() => {
      const first = this.editableItems().find((i) => !this.normalize(i.wp_number));
      if (!first) return;
      const input = document.querySelector<HTMLInputElement>(`[data-wp-input="${first.id}"]`);
      input?.focus();
    });
  }
}
