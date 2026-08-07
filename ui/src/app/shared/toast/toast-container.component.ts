import { animate, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ToastService, ToastType } from '../../core/services/toast.service';

interface ToastTheme {
  /** Icon chip: tinted like the status badges rather than a full colour block. */
  chip: string;
  bar: string;
  icon: string;
}

const THEMES: Record<ToastType, ToastTheme> = {
  success: {
    chip: 'bg-emerald-50 text-emerald-600',
    bar: 'bg-emerald-500',
    icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  error: {
    chip: 'bg-red-50 text-red-600',
    bar: 'bg-red-500',
    icon: 'm9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  warning: {
    chip: 'bg-amber-50 text-amber-600',
    bar: 'bg-amber-500',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  },
  info: {
    chip: 'bg-primary-50 text-primary-600',
    bar: 'bg-primary-500',
    icon: 'm11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
  },
};

@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  animations: [
    trigger('toast', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(1.5rem) scale(0.96)' }),
        animate('220ms cubic-bezier(0.21, 1.02, 0.73, 1)', style({ opacity: 1, transform: 'none' })),
      ]),
      transition(':leave', [
        animate('160ms ease-in', style({ opacity: 0, transform: 'translateX(1.5rem) scale(0.96)' })),
      ]),
    ]),
  ],
  template: `
    <div
      class="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3
             sm:inset-x-auto sm:bottom-6 sm:right-6"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          @toast
          class="pointer-events-auto w-full overflow-hidden rounded-xl border border-slate-200 bg-white
                 shadow-lg shadow-slate-900/10 sm:w-96"
          [attr.role]="toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'"
          (mouseenter)="hold(toast.id)"
          (mouseleave)="release(toast.id)"
          (focusin)="hold(toast.id)"
          (focusout)="release(toast.id)"
        >
          <div class="flex items-start gap-3 p-4">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              [ngClass]="themes[toast.type].chip"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.8"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="themes[toast.type].icon" />
              </svg>
            </span>

            <div class="min-w-0 flex-1 pt-0.5">
              <p class="text-sm font-semibold text-slate-800">{{ toast.title }}</p>
              <p class="mt-0.5 break-words text-sm leading-snug text-slate-500">{{ toast.message }}</p>
            </div>

            <button
              type="button"
              class="-m-1 shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100
                     hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Dismiss notification"
              (click)="toastService.remove(toast.id)"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Remaining time, so a toast never vanishes without warning. -->
          <div class="h-1 w-full bg-slate-100">
            <div
              class="toast-progress h-full"
              [ngClass]="themes[toast.type].bar"
              [class.toast-progress--paused]="held() === toast.id"
              [style.animation-duration.ms]="toast.duration"
            ></div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
  readonly themes = THEMES;

  /** Only the pointed-at toast pauses; the rest of the stack keeps counting down. */
  readonly held = signal<string | null>(null);

  hold(id: string): void {
    this.held.set(id);
    this.toastService.pause(id);
  }

  release(id: string): void {
    if (this.held() === id) this.held.set(null);
    this.toastService.resume(id);
  }
}
