import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
            <i [class]="'ti ' + item.icon + ' text-lg leading-none flex-shrink-0'"></i>
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
            <i class="ti ti-settings text-lg leading-none flex-shrink-0"></i>
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
            <i class="ti ti-logout text-base leading-none"></i>
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
    { label: 'Dashboard', path: '/dashboard', icon: 'ti-layout-dashboard' },
    { label: 'Invoices',  path: '/invoices',  icon: 'ti-file-invoice'     },
    { label: 'Clients',   path: '/clients',   icon: 'ti-users'            },
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
