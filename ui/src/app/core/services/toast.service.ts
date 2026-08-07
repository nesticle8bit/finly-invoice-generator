import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  title: string;
  duration: number;
}

/** The title carries the outcome, so the message can stay a short sentence. */
const DEFAULT_TITLES: Record<ToastType, string> = {
  success: 'Success',
  error: 'Something went wrong',
  info: 'Heads up',
  warning: 'Warning',
};

/** Past four the stack covers the viewport and the oldest is unreadable anyway. */
const MAX_VISIBLE = 4;

interface Timer {
  handle: ReturnType<typeof setTimeout>;
  startedAt: number;
  remaining: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  /** Kept outside the signal: the countdown is not something the view renders. */
  private readonly timers = new Map<string, Timer>();

  show(message: string, type: ToastType = 'info', duration = 4000, title?: string): void {
    // A request that keeps failing should refresh one toast, not stack ten.
    const duplicate = this.toasts().find((t) => t.message === message && t.type === type);
    if (duplicate) {
      this.arm(duplicate.id, duplicate.duration);
      return;
    }

    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, message, type, title: title ?? DEFAULT_TITLES[type], duration };

    const overflow = this.toasts().slice(0, Math.max(0, this.toasts().length + 1 - MAX_VISIBLE));
    overflow.forEach((t) => this.disarm(t.id));
    const dropped = new Set(overflow.map((t) => t.id));

    this.toasts.update((list) => [...list.filter((t) => !dropped.has(t.id)), toast]);
    this.arm(id, duration);
  }

  success(message: string, title?: string): void { this.show(message, 'success', 4000, title); }
  error(message: string, title?: string): void { this.show(message, 'error', 6000, title); }
  info(message: string, title?: string): void { this.show(message, 'info', 4000, title); }
  warning(message: string, title?: string): void { this.show(message, 'warning', 5000, title); }

  remove(id: string): void {
    this.disarm(id);
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  /** Hovering or focusing a toast holds it open — reading it should not race a timer. */
  pause(id: string): void {
    const timer = this.timers.get(id);
    if (!timer) return;

    clearTimeout(timer.handle);
    this.timers.set(id, {
      ...timer,
      remaining: Math.max(0, timer.remaining - (Date.now() - timer.startedAt)),
    });
  }

  resume(id: string): void {
    const timer = this.timers.get(id);
    if (timer) this.arm(id, timer.remaining);
  }

  private arm(id: string, remaining: number): void {
    this.disarm(id);
    this.timers.set(id, {
      handle: setTimeout(() => this.remove(id), remaining),
      startedAt: Date.now(),
      remaining,
    });
  }

  private disarm(id: string): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer.handle);
    this.timers.delete(id);
  }
}
