import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { MatTooltip } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgClass, MatTooltip],
  template: `
    <aside class="fixed left-0 top-0 h-screen w-64 bg-dark-900 flex flex-col z-30 border-r border-white/5">
      <!-- Logo -->
      <div class="flex items-center gap-3 px-6 py-5 border-b border-white/5">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg">
          <span class="text-white font-black text-base">F</span>
        </div>
        <div>
          <p class="text-white font-bold text-sm leading-tight">Finly</p>
          <p class="text-slate-400 text-xs">Invoice Generator</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        <p class="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">Main</p>

        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="bg-primary-600/20 text-primary-400 border-primary-500"
            [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 border border-transparent group text-sm font-medium"
          >
            <span class="text-base w-5 flex justify-center" [innerHTML]="item.icon"></span>
            <span>{{ item.label }}</span>
          </a>
        }

        <div class="pt-3 mt-3 border-t border-white/5">
          <p class="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">Account</p>
          <a
            routerLink="/settings"
            routerLinkActive="bg-primary-600/20 text-primary-400 border-primary-500"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 border border-transparent text-sm font-medium"
          >
            <span class="text-base w-5 flex justify-center">⚙</span>
            <span>Settings</span>
          </a>
        </div>
      </nav>

      <!-- Footer credit -->
      <div class="mx-3 mb-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
        <p class="text-slate-600 text-[11px] tracking-wide">
          developed with <span class="text-pink-500">❤️</span> by
          <a href="https://juliopoveda.com" target="_blank" rel="noopener noreferrer"
             class="text-slate-400 hover:text-primary-400 transition-colors duration-200 font-semibold">
            Julio Poveda
          </a>
        </p>
      </div>

      <!-- User Info -->
      <div class="px-3 pb-4 border-t border-white/5 pt-3">
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center flex-shrink-0">
            <span class="text-white font-bold text-xs">{{ userInitials() }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-white text-xs font-semibold truncate">{{ userName() }}</p>
            <p class="text-slate-500 text-xs truncate">{{ userEmail() }}</p>
          </div>
          <button
            (click)="logout()"
            class="text-slate-500 hover:text-red-400 transition-colors"
            matTooltip="Logout"
            matTooltipPosition="right"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  private auth = inject(AuthService);

  navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: '⬡' },
    { label: 'Invoices', path: '/invoices', icon: '◧' },
    { label: 'Clients', path: '/clients', icon: '◉' },
  ];

  userName = () => this.auth.currentUser()?.name || 'User';
  userEmail = () => this.auth.currentUser()?.email || '';
  userInitials = () => {
    const name = this.auth.currentUser()?.name || 'U';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  logout(): void {
    this.auth.logout();
  }
}
