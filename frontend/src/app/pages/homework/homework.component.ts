import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';

const INPUT = 'w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm text-[#1A1A1B] placeholder-[#9CA3AF] outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition';

@Component({
  selector: 'app-homework',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6 max-w-xl">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">Домашние задания</h1>

      <div class="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] px-5 py-4">
        <p class="text-sm text-[#005BFF] font-medium mb-1">Как сдать?</p>
        <p class="text-xs text-[#4B72B0] leading-relaxed">
          Сформируйте группу 1–3 студента, оформите решение в Google Docs и отправьте ссылку.
          Включите себя в список участников (через запятую).
        </p>
      </div>

      <div class="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
        <p class="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Отправить решение</p>

        <div>
          <label class="block text-xs font-medium text-[#1A1A1B] mb-1.5">ID занятия</label>
          <input [class]="INPUT" placeholder="Activity ID" [(ngModel)]="activityId" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[#1A1A1B] mb-1.5">ID задания</label>
          <input [class]="INPUT" placeholder="Task Item ID" [(ngModel)]="taskItemId" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[#1A1A1B] mb-1.5">Ссылка на Google Doc</label>
          <input [class]="INPUT" placeholder="https://docs.google.com/..." [(ngModel)]="docUrl" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[#1A1A1B] mb-1.5">User ID участников</label>
          <input [class]="INPUT" placeholder="id1, id2, id3" [(ngModel)]="members" />
          <p class="text-xs text-[#9CA3AF] mt-1">Ваш User ID можно найти в профиле</p>
        </div>

        <button (click)="submit()" [disabled]="loading()"
          class="h-10 px-5 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] disabled:opacity-60 transition-colors flex items-center gap-2">
          {{ loading() ? 'Отправка...' : '📤 Отправить' }}
        </button>
      </div>
    </div>
  `
})
export class HomeworkComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  activityId = '';
  taskItemId = '';
  docUrl = '';
  members = '';
  loading = signal(false);
  readonly INPUT = INPUT;

  async submit() {
    const memberIds = this.members.split(',').map(s => s.trim()).filter(Boolean);
    if (!this.activityId || !this.taskItemId || !this.docUrl || memberIds.length === 0) {
      this.toast.error('Заполните все поля');
      return;
    }
    this.loading.set(true);
    try {
      await this.api.submitHomework({
        activityId: this.activityId,
        taskItemId: this.taskItemId,
        documentUrl: this.docUrl,
        memberUserIds: memberIds,
      });
      this.toast.success('Сдача создана!');
      this.docUrl = '';
      this.members = '';
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      this.loading.set(false);
    }
  }
}
