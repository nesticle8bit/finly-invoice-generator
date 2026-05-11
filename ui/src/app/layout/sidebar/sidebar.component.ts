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
    <aside class="fixed left-0 top-0 h-screen w-64 flex flex-col z-30 bg-dark-950 border-r border-white/[0.06]">

      <!-- Logo -->
      <div class="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06] flex-shrink-0">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30 flex-shrink-0">
          <span class="text-white font-black text-sm">F</span>
        </div>
        <div>
          <p class="text-white font-bold text-sm leading-tight tracking-tight">Finly</p>
          <p class="text-slate-500 text-[11px] leading-tight">Invoice Generator</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-5 flex flex-col gap-0.5 overflow-y-auto">

        <p class="px-3 mb-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-[0.12em]">Menu</p>

        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active-nav"
            [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
            class="nav-item group flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-all duration-150 text-sm font-medium"
          >
            <span class="w-5 h-5 flex-shrink-0 flex items-center justify-center" [innerHTML]="item.icon"></span>
            <span class="truncate">{{ item.label }}</span>
          </a>
        }

        <div class="mt-auto pt-4">
          <p class="px-3 mb-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-[0.12em]">Account</p>
          <a
            routerLink="/settings"
            routerLinkActive="active-nav"
            class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-all duration-150 text-sm font-medium"
          >
            <span class="w-5 h-5 flex-shrink-0 flex items-center justify-center">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-[18px] h-[18px]">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </span>
            <span>Settings</span>
          </a>
        </div>
      </nav>

      <!-- User card -->
      <div class="px-3 py-3 border-t border-white/[0.06] flex-shrink-0">
        <div class="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] transition-colors group">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center flex-shrink-0 shadow-md">
            <span class="text-white font-bold text-xs">{{ userInitials() }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-slate-200 text-xs font-semibold truncate leading-tight">{{ userName() }}</p>
            <p class="text-slate-500 text-[11px] truncate leading-tight mt-0.5">{{ userEmail() }}</p>
          </div>
          <button
            (click)="logout()"
            class="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
            matTooltip="Sign out"
            matTooltipPosition="right"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
        <p class="text-slate-700 text-[10px] text-center mt-2.5 tracking-wide">
          made with <span class="text-pink-600">♥</span> by
          <a href="https://juliopoveda.com" target="_blank" rel="noopener noreferrer" class="text-slate-600 hover:text-primary-400 transition-colors font-medium">Julio Poveda</a>
        </p>
      </div>
    </aside>

    <style>
      .active-nav {
        color: #a5b4fc !important;
        background: rgba(99, 102, 241, 0.12) !important;
      }
      .active-nav svg {
        color: #818cf8;
      }
    </style>
  `,
})
export class SidebarComponent {
  private auth = inject(AuthService);

  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-[18px] h-[18px]"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
    },
    {
      label: 'Invoices',
      path: '/invoices',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-[18px] h-[18px]"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
    },
    {
      label: 'Clients',
      path: '/clients',
      icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-[18px] h-[18px]"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
    },
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
