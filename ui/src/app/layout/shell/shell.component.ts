import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="flex h-screen bg-dark-50 overflow-hidden">
      <app-sidebar />
      <main class="flex-1 ml-64 overflow-y-auto scrollbar-thin">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent {}
