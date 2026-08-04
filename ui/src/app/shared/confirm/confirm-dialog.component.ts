import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirmService.pending(); as dialog) {
      <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
        <!-- Backdrop is a button so dismissing it works with a keyboard too. -->
        <button
          type="button"
          class="absolute inset-0 h-full w-full cursor-default bg-slate-900/50"
          aria-label="Dismiss dialog"
          (click)="confirmService.respond(false)"
        ></button>

        <div
          class="card relative w-full max-w-sm p-6"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="dialog.title"
        >
          <h2 class="text-lg font-bold text-slate-800">{{ dialog.title }}</h2>
          <p class="mt-2 text-sm text-slate-500">{{ dialog.message }}</p>

          <div class="mt-6 flex justify-end gap-2">
            <button type="button" class="btn-secondary" (click)="confirmService.respond(false)">
              {{ dialog.cancelLabel ?? 'Cancel' }}
            </button>
            <button
              type="button"
              class="btn-primary"
              [class.bg-red-600]="dialog.danger"
              [class.hover:bg-red-700]="dialog.danger"
              cdkFocusInitial
              (click)="confirmService.respond(true)"
            >
              {{ dialog.confirmLabel ?? 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly confirmService = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmService.pending()) this.confirmService.respond(false);
  }
}
