import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="flex h-screen bg-dark-50 overflow-hidden">
      <!-- Off-canvas below lg, fixed column from lg up. -->
      <app-sidebar [class.max-lg:-translate-x-full]="!menuOpen()" class="transition-transform duration-200" />

      @if (menuOpen()) {
        <button
          type="button"
          class="fixed inset-0 z-20 bg-slate-900/50 lg:hidden"
          aria-label="Close menu"
          (click)="menuOpen.set(false)"
        ></button>
      }

      <div class="flex flex-1 flex-col overflow-hidden lg:ml-64">
        <!-- Mobile top bar: the only way to reach navigation on small screens. -->
        <header class="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            class="btn-ghost p-2"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="app-sidebar"
            aria-label="Toggle navigation"
            (click)="toggleMenu()"
          >
            <i class="ti ti-menu-2 text-xl"></i>
          </button>
          <span class="font-bold text-slate-800">Finly</span>
        </header>

        <main class="flex-1 overflow-y-auto scrollbar-thin">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  private router = inject(Router);

  menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  constructor() {
    // Navigating from the off-canvas menu should close it.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.menuOpen.set(false));
  }
}
