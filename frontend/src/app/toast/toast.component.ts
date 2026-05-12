import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 min-w-72 max-w-sm">
      @for (t of toast.toasts(); track t.id) {
        <div
          class="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm animate-fade-in"
          [class]="bgClass(t.type)"
        >
          <span class="text-lg leading-none mt-0.5">{{ icon(t.type) }}</span>
          <div class="flex-1 min-w-0">
            <p class="font-medium" [class]="textClass(t.type)">{{ t.message }}</p>
            @if (t.description) {
              <p class="text-xs opacity-70 mt-0.5">{{ t.description }}</p>
            }
          </div>
          <button (click)="toast.remove(t.id)" class="opacity-50 hover:opacity-100 transition-opacity shrink-0 text-xs">✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fade-in { animation: fade-in 0.2s ease-out; }
  `]
})
export class ToastComponent {
  toast = inject(ToastService);

  icon(type: string) {
    return type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'info' ? 'ℹ' : '⚠';
  }

  bgClass(type: string) {
    return {
      success: 'bg-[#D1FAE5] border-[#6EE7B7]',
      error: 'bg-[#FEE2E2] border-[#FCA5A5]',
      info: 'bg-[#EAF2FF] border-[#C7DCFF]',
      warning: 'bg-[#FEF3C7] border-[#FCD34D]',
    }[type] ?? 'bg-white border-[#E5E7EB]';
  }

  textClass(type: string) {
    return {
      success: 'text-[#065F46]',
      error: 'text-[#991B1B]',
      info: 'text-[#1E40AF]',
      warning: 'text-[#92400E]',
    }[type] ?? 'text-[#1A1A1B]';
  }
}
