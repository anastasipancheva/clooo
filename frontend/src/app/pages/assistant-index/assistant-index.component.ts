import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import { StudentActivity, AssistantSession } from '../../core/models';

interface AppState { message: string; submitting: boolean; done: boolean; }
interface ModuleStat {
  moduleNumber: number; moduleTitle: string; courseCode: string; courseTitle: string;
  count: number; moduleId: string;
}

@Component({
  selector: 'app-assistant-index',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  template: `
    <div class="space-y-6 max-w-3xl">

      <!-- Hero -->
      <div class="bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] rounded-2xl px-6 py-5 text-white">
        <p class="text-sm font-medium opacity-80 mb-0.5">Панель ассистента</p>
        <h1 class="text-xl font-bold">{{ auth.user()?.displayName }}</h1>
        <p class="text-sm opacity-70 mt-0.5">{{ totalSessions }} {{ plural(totalSessions, 'одобренная сессия', 'одобренные сессии', 'одобренных сессий') }}</p>
      </div>

      <!-- Active sessions RIGHT NOW -->
      @if (activeLectures.length + activeKts.length > 0) {
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[#059669] animate-pulse"></span>
            <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Идёт сейчас</p>
          </div>
          @for (a of activeLectures; track a.id) {
            <a [routerLink]="['/assistant/session', a.id]"
               class="bg-white border-2 border-[#7C3AED]/30 rounded-xl p-4 flex items-center justify-between hover:border-[#7C3AED]/60 hover:shadow-sm transition-all block">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-[#EAF2FF] flex items-center justify-center text-xl flex-shrink-0">📖</div>
                <div>
                  <p class="text-sm font-semibold text-[#1A1A1B]">{{ a.title }}</p>
                  <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ a.moduleTitle }} · Лекция/Пара</p>
                </div>
              </div>
              <span class="text-xs font-semibold text-white bg-[#7C3AED] px-3 py-1.5 rounded-lg flex-shrink-0">Войти →</span>
            </a>
          }
          @for (a of activeKts; track a.id) {
            <a [routerLink]="['/assistant/kt', a.id]"
               class="bg-white border-2 border-[#D97706]/30 rounded-xl p-4 flex items-center justify-between hover:border-[#D97706]/60 hover:shadow-sm transition-all block">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-xl flex-shrink-0">📝</div>
                <div>
                  <p class="text-sm font-semibold text-[#1A1A1B]">{{ a.title }}</p>
                  <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ a.moduleTitle }} · КТ</p>
                </div>
              </div>
              <span class="text-xs font-semibold text-white bg-[#D97706] px-3 py-1.5 rounded-lg flex-shrink-0">Войти →</span>
            </a>
          }
        </div>
      }

      <!-- Stats per module -->
      @if (moduleStats.length > 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E5E7EB]">
            <p class="text-sm font-semibold text-[#1A1A1B]">🏆 Мои одобренные сессии</p>
          </div>
          <div class="divide-y divide-[#F9FAFB]">
            @for (stat of moduleStats; track stat.moduleId) {
              <div class="px-5 py-3 flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-[#1A1A1B]">
                    <span class="text-[#6B7280]">{{ stat.courseCode }}</span>
                    · М{{ stat.moduleNumber }} — {{ stat.moduleTitle }}
                  </p>
                  <p class="text-xs text-[#9CA3AF]">{{ stat.courseTitle }}</p>
                </div>
                <div class="flex-shrink-0 w-9 h-9 rounded-full bg-[#EAF2FF] flex items-center justify-center">
                  <span class="text-sm font-bold text-[#005BFF]">{{ stat.count }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Apply to activities -->
      <div class="space-y-3">
        <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Подать заявку на занятие</p>

        @if (upcoming.length === 0 && !loading) {
          <div class="bg-white rounded-xl border border-dashed border-[#E5E7EB] p-8 text-center">
            <p class="text-2xl mb-2">📭</p>
            <p class="text-sm text-[#6B7280] mb-1">Нет доступных занятий</p>
            <p class="text-xs text-[#9CA3AF] mb-3">Запишитесь на курс чтобы подавать заявки</p>
            <a routerLink="/courses" class="text-xs text-[#005BFF] font-medium hover:underline">Перейти к курсам →</a>
          </div>
        }

        @for (a of upcoming; track a.id) {
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  [class]="a.status === 'Active' ? 'bg-[#D1FAE5]' : 'bg-[#F3F4F6]'">
                  {{ a.type === 2 ? '📝' : '📖' }}
                </div>
                <div>
                  <p class="text-sm font-semibold text-[#1A1A1B]">{{ a.title }}</p>
                  <p class="text-xs text-[#6B7280]">
                    {{ a.courseCode }} · {{ a.typeLabel }} · {{ fmtDate(a.startsAt) }}
                  </p>
                </div>
              </div>
              @if (a.status === 'Active') {
                <span class="text-xs font-semibold bg-[#D1FAE5] text-[#059669] px-2.5 py-1 rounded-full flex-shrink-0">Идёт</span>
              } @else {
                <span class="text-xs text-[#D97706] bg-[#FEF3C7] px-2.5 py-1 rounded-full flex-shrink-0 font-medium">{{ fmtCountdown(a.startsAt) }}</span>
              }
            </div>

            @if (appStates[a.id]; as state) {
              @if (state.done) {
                <div class="flex items-center gap-2 bg-[#F0FDF4] rounded-lg px-3 py-2">
                  <span class="text-[#059669]">✓</span>
                  <p class="text-xs text-[#059669] font-medium">Заявка подана — ожидайте подтверждения</p>
                </div>
              } @else {
                <div class="flex gap-2">
                  <input type="text" placeholder="Комментарий для преподавателя (необязательно)"
                    [(ngModel)]="state.message"
                    class="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 transition" />
                  <button (click)="apply(a.id)" [disabled]="state.submitting"
                    class="h-9 px-4 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold hover:bg-[#6D28D9] disabled:opacity-60 transition-colors whitespace-nowrap">
                    {{ state.submitting ? '⏳' : '+ Заявка' }}
                  </button>
                </div>
              }
            }
          </div>
        }
      </div>

      <!-- Hint -->
      <div class="bg-[#F5F3FF] rounded-xl border border-[#DDD6FE] px-5 py-4">
        <p class="text-xs text-[#7C3AED] leading-relaxed">
          💡 После одобрения заявки преподавателем сессия появится в блоке «Идёт сейчас» выше. Вы также получите уведомление.
        </p>
      </div>
    </div>
  `
})
export class AssistantIndexComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  activities: StudentActivity[] = [];
  appStates: Record<string, AppState> = {};
  moduleStats: ModuleStat[] = [];
  loading = true;

  get activeLectures() { return this.activities.filter(a => a.status === 'Active' && a.type !== 2); }
  get activeKts()      { return this.activities.filter(a => a.status === 'Active' && a.type === 2); }
  get upcoming()       { return this.activities.filter(a => a.status === 'Scheduled' || a.status === 'Active'); }
  get totalSessions()  { return this.moduleStats.reduce((s, m) => s + m.count, 0); }

  ngOnInit() {
    this.api.myActivities().then(acts => {
      this.activities = acts;
      acts.forEach(a => {
        this.appStates[a.id] = { message: '', submitting: false, done: false };
      });
      this.loading = false;
    }).catch(() => { this.loading = false; });

    this.api.mySessions().then(sessions => {
      const map = new Map<string, ModuleStat>();
      for (const s of sessions) {
        if (!map.has(s.moduleId)) {
          map.set(s.moduleId, {
            moduleNumber: s.moduleNumber, moduleTitle: s.moduleTitle,
            courseCode: s.courseCode, courseTitle: s.courseTitle,
            count: 0, moduleId: s.moduleId,
          });
        }
        map.get(s.moduleId)!.count++;
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
      this.toast.success('Заявка подана! Ожидайте подтверждения.');
      state.done = true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      if (msg.includes('Already applied')) { this.toast.info('Вы уже подали заявку'); state.done = true; }
      else this.toast.error(msg);
    } finally { state.submitting = false; }
  }

  fmtDate(d: string) { return new Date(d).toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }

  fmtCountdown(d: string) {
    const diff = new Date(d).getTime() - Date.now();
    if (diff <= 0) return 'скоро';
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `через ${days} д.`;
    const hrs = Math.floor(diff / 3600000);
    if (hrs > 0) return `через ${hrs} ч.`;
    return `через ${Math.floor(diff / 60000)} мин.`;
  }

  plural(n: number, one: string, few: string, many: string) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }
}
