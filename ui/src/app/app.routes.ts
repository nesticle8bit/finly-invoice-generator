import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'invoices',
        loadComponent: () => import('./features/invoices/invoice-list/invoice-list.component').then((m) => m.InvoiceListComponent),
      },
      {
        path: 'invoices/new',
        loadComponent: () => import('./features/invoices/invoice-editor/invoice-editor.component').then((m) => m.InvoiceEditorComponent),
      },
      {
        path: 'invoices/:id/edit',
        loadComponent: () => import('./features/invoices/invoice-editor/invoice-editor.component').then((m) => m.InvoiceEditorComponent),
      },
      {
        path: 'invoices/:id/preview',
        loadComponent: () => import('./features/invoices/invoice-preview/invoice-preview.component').then((m) => m.InvoicePreviewComponent),
      },
      {
        path: 'clients',
        loadComponent: () => import('./features/clients/clients.component').then((m) => m.ClientsComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  // Public share page — no auth required
  {
    path: 'share/:token',
    loadComponent: () => import('./features/share/share.component').then((m) => m.ShareComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
