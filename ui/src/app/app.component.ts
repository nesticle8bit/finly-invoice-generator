import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgFor, NgClass } from '@angular/common';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgFor, NgClass],
  template: `
    <router-outlet />

    <!-- Global Toast Notifications -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in min-w-72 max-w-sm"
          [ngClass]="{
            'bg-emerald-600 text-white': toast.type === 'success',
            'bg-red-600 text-white': toast.type === 'error',
            'bg-primary-600 text-white': toast.type === 'info',
            'bg-amber-500 text-white': toast.type === 'warning'
          }"
        >
          <span class="text-lg">
            @if (toast.type === 'success') { ✓ }
            @else if (toast.type === 'error') { ✕ }
            @else if (toast.type === 'warning') { ⚠ }
            @else { ℹ }
          </span>
          <span class="flex-1">{{ toast.message }}</span>
          <button
            (click)="toastService.remove(toast.id)"
            class="opacity-75 hover:opacity-100 transition-opacity"
          >✕</button>
        </div>
      }
    </div>
  `,
})
export class AppComponent {
  toastService = inject(ToastService);
}
