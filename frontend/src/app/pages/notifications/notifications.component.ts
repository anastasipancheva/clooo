import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { Notification } from '../../core/models';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6 max-w-2xl">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-[#1A1A1B]">Уведомления</h1>
        @if (unread.length > 0) {
          <span class="text-xs bg-[#EAF2FF] text-[#005BFF] font-medium px-2.5 py-1 rounded-full">{{ unread.length }} новых</span>
        }
      </div>

      @if (list.length === 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-10 text-center">
          <p class="text-4xl mb-3">🔔</p>
          <p class="text-sm text-[#6B7280]">Нет уведомлений</p>
        </div>
      }

      @if (unread.length > 0) {
        <div class="space-y-2">
          @for (n of unread; track n.id) {
            <div class="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] p-4 flex items-start justify-between gap-3">
              <div class="space-y-1 flex-1">
                <p class="text-sm font-semibold text-[#1A1A1B]">{{ n.title }}</p>
                @if (n.body) { <p class="text-xs text-[#6B7280] break-words" [innerHTML]="linkify(n.body)"></p> }
                <p class="text-xs text-[#9CA3AF]">{{ n.createdAt | date:'short' }}</p>
              </div>
              <button (click)="markRead(n.id)"
                class="flex items-center gap-1.5 text-xs text-[#005BFF] hover:text-[#0050E6] font-medium shrink-0 mt-0.5">
                ✓ Прочитано
              </button>
            </div>
          }
        </div>
      }

      @if (read.length > 0) {
        <div class="space-y-2">
          <p class="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Прочитанные</p>
          @for (n of read; track n.id) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] p-4">
              <p class="text-sm font-medium text-[#6B7280]">{{ n.title }}</p>
              @if (n.body) { <p class="text-xs text-[#9CA3AF] mt-0.5 break-words" [innerHTML]="linkify(n.body)"></p> }
              <p class="text-xs text-[#9CA3AF] mt-1">{{ n.createdAt | date:'short' }}</p>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);
  list: Notification[] = [];
  get unread() { return this.list.filter(n => !n.readAt); }
  get read() { return this.list.filter(n => n.readAt); }

  ngOnInit() { this.api.listNotifications().then(n => this.list = n).catch(() => {}); }

  async markRead(id: string) {
    await this.api.markNotificationRead(id).catch(() => {});
    this.list = this.list.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n);
  }

  // Превращает URL в теле уведомления в кликабельные ссылки (Angular санитайзит innerHTML).
  linkify(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener" class="text-[#005BFF] underline">$1</a>');
  }
}
