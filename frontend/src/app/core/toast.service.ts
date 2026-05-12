import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface Toast { id: number; type: ToastType; message: string; description?: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  toasts = signal<Toast[]>([]);

  private add(type: ToastType, message: string, description?: string, duration = 4000) {
    const id = ++this.counter;
    this.toasts.update(list => [...list, { id, type, message, description }]);
    setTimeout(() => this.remove(id), duration);
  }

  success(msg: string, desc?: string) { this.add('success', msg, desc); }
  error(msg: string, desc?: string) { this.add('error', msg, desc); }
  info(msg: string, desc?: string) { this.add('info', msg, desc); }
  warning(msg: string, desc?: string) { this.add('warning', msg, desc); }
  remove(id: number) { this.toasts.update(list => list.filter(t => t.id !== id)); }
}
