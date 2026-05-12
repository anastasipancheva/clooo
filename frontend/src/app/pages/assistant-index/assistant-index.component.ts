import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { StudentActivity, AssistantSession } from '../../core/models';

interface AppState { activityId: string; message: string; submitting: boolean; done: boolean; }
interface ModuleStat {
  moduleNumber: number; moduleTitle: string; courseCode: string; courseTitle: string;
  count: number; moduleId: string;
}

@Component({
  selector: 'app-assistant-index',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  template: `
    <div class="space-y-6 max-w-2xl">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">Панель ассистента</h1>

      <!-- Session counter per module -->
      @if (moduleStats.length > 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
            <span class="text-[#005BFF]">🏆</span>
            <p class="text-sm font-semibold text-[#1A1A1B]">Мои одобренные сессии</p>
          </div>
          <div class="divide-y divide-[#F3F4F6]">
            @for (stat of moduleStats; track stat.moduleId) {
              <div class="px-5 py-3 flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-[#1A1A1B]">
                    {{ stat.courseCode }} · М{{ stat.moduleNumber }} — {{ stat.moduleTitle }}
                  </p>
                  <p class="text-xs text-[#6B7280]">{{ stat.courseTitle }}</p>
                </div>
                <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[#EAF2FF] flex items-center justify-center text-sm font-bold text-[#005BFF]">
                  {{ stat.count }}
                </span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Quick links to session pages -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div class="w-9 h-9 rounded-lg bg-[#EAF2FF] flex items-center justify-center mb-3 text-lg">📖</div>
          <h2 class="text-sm font-semibold text-[#1A1A1B] mb-1">Лекция / пара</h2>
          <p class="text-xs text-[#6B7280] mb-3">Перейти к активной сессии:</p>
          <div class="space-y-1">
            @for (a of activeLectures; track a.id) {
              <a [routerLink]="['/assistant/session', a.id]"
                class="flex items-center justify-between px-3 py-2 rounded-lg bg-[#EAF2FF] hover:bg-[#D1E6FF] transition-colors">
                <span class="text-xs font-medium text-[#005BFF] truncate">{{ a.title }}</span>
                <span class="text-[#005BFF] flex-shrink-0">›</span>
              </a>
            }
            @if (activeLectures.length === 0) {
              <p class="text-xs text-[#9CA3AF]">Нет активных лекций</p>
            }
          </div>
        </div>

        <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div class="w-9 h-9 rounded-lg bg-[#EAF2FF] flex items-center justify-center mb-3 text-lg">📋</div>
          <h2 class="text-sm font-semibold text-[#1A1A1B] mb-1">Контрольная точка</h2>
          <p class="text-xs text-[#6B7280] mb-3">Перейти к активной КТ:</p>
          <div class="space-y-1">
            @for (a of activeKts; track a.id) {
              <a [routerLink]="['/assistant/kt', a.id]"
                class="flex items-center justify-between px-3 py-2 rounded-lg bg-[#EAF2FF] hover:bg-[#D1E6FF] transition-colors">
                <span class="text-xs font-medium text-[#005BFF] truncate">{{ a.title }}</span>
                <span class="text-[#005BFF] flex-shrink-0">›</span>
              </a>
            }
            @if (activeKts.length === 0) {
              <p class="text-xs text-[#9CA3AF]">Нет активных КТ</p>
            }
          </div>
        </div>
      </div>

      <!-- Apply to activities -->
      <div class="space-y-3">
        <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Подать заявку на занятие</p>

        @if (upcoming.length === 0) {
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-6 text-center">
            <p class="text-sm text-[#9CA3AF]">Нет предстоящих занятий. Нужно быть записанным на курс.</p>
            <a routerLink="/courses" class="inline-flex items-center gap-1 mt-2 text-xs text-[#005BFF] hover:underline">
              Перейти к курсам ›
            </a>
          </div>
        }

        @for (a of upcoming; track a.id) {
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-[#1A1A1B]">{{ a.title }}</p>
                <p class="text-xs text-[#6B7280]">
                  {{ a.courseCode }} · {{ a.typeLabel }} · {{ fmtDate(a.startsAt) }}
                </p>
              </div>
              @if (a.status === 'Active') {
                <span class="text-xs font-medium bg-[#D1FAE5] text-[#059669] px-2.5 py-1 rounded-full">Идёт</span>
              }
            </div>

            @if (appState(a.id); as state) {
              @if (!state.done) {
                <div class="flex gap-2">
                  <input type="text" placeholder="Сообщение для преподавателя (необязательно)"
                    [(ngModel)]="state.message"
                    class="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition" />
                  <button (click)="apply(a.id)" [disabled]="state.submitting"
                    class="h-9 px-4 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] disabled:opacity-60 transition-colors">
                    {{ state.submitting ? '...' : 'Подать заявку' }}
                  </button>
                </div>
              } @else {
                <p class="text-xs text-[#059669] font-medium">✓ Заявка подана — ожидайте подтверждения</p>
              }
            }
          </div>
        }
      </div>

      <div class="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] px-5 py-4">
        <p class="text-xs text-[#4B72B0] leading-relaxed">
          После одобрения заявки преподавателем вы получите уведомление и ссылки на сессию появятся в блоке выше.
        </p>
      </div>
    </div>
  `
})
export class AssistantIndexComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  activities: StudentActivity[] = [];
  appStates: Record<string, AppState> = {};
  moduleStats: ModuleStat[] = [];

  get activeLectures() { return this.activities.filter(a => a.status === 'Active' && a.type === 0); }
  get activeKts() { return this.activities.filter(a => a.status === 'Active' && a.type === 1); }
  get upcoming() { return this.activities.filter(a => a.status === 'Scheduled' || a.status === 'Active'); }

  appState(id: string): AppState { return this.appStates[id]; }

  ngOnInit() {
    this.api.myActivities().then(acts => {
      this.activities = acts;
      acts.forEach(a => {
        this.appStates[a.id] = { activityId: a.id, message: '', submitting: false, done: false };
      });
    }).catch(() => {});

    this.api.mySessions().then(sessions => {
      const map = new Map<string, ModuleStat>();
      for (const s of sessions) {
        const key = s.moduleId;
        if (!map.has(key)) {
          map.set(key, {
            moduleNumber: s.moduleNumber, moduleTitle: s.moduleTitle,
            courseCode: s.courseCode, courseTitle: s.courseTitle,
            count: 0, moduleId: s.moduleId,
          });
        }
        map.get(key)!.count++;
      }
      this.moduleStats = Array.from(map.values())
        .sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.moduleNumber - b.moduleNumber);
    }).catch(() => {});
  }

  async apply(activityId: string) {
    const state = this.appStates[activityId];
    if (!state) return;
    state.submitting = true;
    try {
      await this.api.applyAssistant(activityId, state.message || undefined);
      this.toast.success('Заявка подана! Ожидайте подтверждения преподавателя.');
      state.done = true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      if (msg.includes('Already applied')) {
        this.toast.info('Вы уже подали заявку на это занятие');
        state.done = true;
      } else {
        this.toast.error(msg);
      }
    } finally {
      state.submitting = false;
    }
  }

  fmtDate(d: string) {
    return new Date(d).toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
