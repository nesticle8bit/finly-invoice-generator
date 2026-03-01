import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, RouterLink],
  template: `
    <div class="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <!-- Background grid -->
      <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cdefs%3E%3Cpattern id=%22grid%22 width=%2260%22 height=%2260%22 patternUnits=%22userSpaceOnUse%22%3E%3Cpath d=%22M 60 0 L 0 0 0 60%22 fill=%22none%22 stroke=%22rgba(255,255,255,0.03)%22 stroke-width=%221%22/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22url(%23grid)%22/%3E%3C/svg%3E')]"></div>

      <!-- Glow effects -->
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl"></div>
      <div class="absolute bottom-1/4 left-1/3 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl"></div>

      <div class="relative w-full max-w-md">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-2xl shadow-primary-500/40 mb-4">
            <span class="text-white font-black text-2xl">F</span>
          </div>
          <h1 class="text-white text-3xl font-bold">Finly</h1>
          <p class="text-slate-400 text-sm mt-1">Invoice Generator</p>
        </div>

        <!-- Card -->
        <div class="bg-dark-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <!-- Tabs -->
          <div class="flex gap-1 p-1 bg-dark-900/60 rounded-xl mb-6">
            <button
              (click)="mode.set('login')"
              class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
              [class.bg-white]="mode() === 'login'"
              [class.text-dark-900]="mode() === 'login'"
              [class.text-slate-400]="mode() !== 'login'"
            >Sign In</button>
            <button
              (click)="mode.set('register')"
              class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
              [class.bg-white]="mode() === 'register'"
              [class.text-dark-900]="mode() === 'register'"
              [class.text-slate-400]="mode() !== 'register'"
            >Register</button>
          </div>

          <!-- Login Form -->
          @if (mode() === 'login') {
            <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  formControlName="email"
                  placeholder="you@example.com"
                  class="w-full px-4 py-3 bg-dark-900/60 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                >
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  formControlName="password"
                  placeholder="••••••••"
                  class="w-full px-4 py-3 bg-dark-900/60 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                >
              </div>
              <button
                type="submit"
                [disabled]="loginForm.invalid || loading()"
                class="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2"
              >
                @if (loading()) { <span>Signing in...</span> } @else { <span>Sign In →</span> }
              </button>
            </form>
          }

          <!-- Register Form -->
          @if (mode() === 'register') {
            <form [formGroup]="registerForm" (ngSubmit)="onRegister()" class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  formControlName="name"
                  placeholder="Julio Poveda"
                  class="w-full px-4 py-3 bg-dark-900/60 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                >
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  formControlName="email"
                  placeholder="you@example.com"
                  class="w-full px-4 py-3 bg-dark-900/60 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                >
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  formControlName="password"
                  placeholder="Min 6 characters"
                  class="w-full px-4 py-3 bg-dark-900/60 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                >
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Invitation Code</label>
                <input
                  type="text"
                  formControlName="invite_code"
                  placeholder="XXXX-XXXX"
                  autocomplete="off"
                  class="w-full px-4 py-3 bg-dark-900/60 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                >
                <p class="text-slate-600 text-xs mt-1.5">Not required for the first account.</p>
              </div>
              <button
                type="submit"
                [disabled]="registerForm.invalid || loading()"
                class="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2"
              >
                @if (loading()) { <span>Creating account...</span> } @else { <span>Create Account →</span> }
              </button>
            </form>
          }
        </div>

        <p class="text-center text-slate-600 text-xs mt-6">Invoice Generator © {{ year }}</p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  mode = signal<'login' | 'register'>('login');
  loading = signal(false);
  year = new Date().getFullYear();

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  registerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    invite_code: [''],
  });

  onLogin(): void {
    if (this.loginForm.invalid || this.loading()) return;
    this.loading.set(true);
    const { email, password } = this.loginForm.value;

    this.auth.login(email!, password!).subscribe({
      next: () => {
        this.toast.success('Welcome back!');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Login failed');
        this.loading.set(false);
      },
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid || this.loading()) return;
    this.loading.set(true);
    const { name, email, password, invite_code } = this.registerForm.value;

    this.auth.register(name!, email!, password!, invite_code || undefined).subscribe({
      next: () => {
        this.toast.success('Account created! Welcome!');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Registration failed');
        this.loading.set(false);
      },
    });
  }
}
