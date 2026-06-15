import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import { StudentActivity, AssistantSession } from '../../core/models';

type AppStatus = 'none' | 'pending' | 'approved' | 'rejected';
interface AppState { message: string; submitting: boolean; done: boolean; status: AppStatus; }
interface ModuleStat {
  moduleNumber: number; moduleTitle: string; courseCode: string; courseTitle: string;
  count: number; moduleId: string;
  sessions: AssistantSession[]; expanded: boolean;
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
                  <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ a.moduleTitle }}</p>
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

      <!-- Approved sessions by module (collapsible) -->
      @if (moduleStats.length > 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E5E7EB]">
            <p class="text-sm font-semibold text-[#1A1A1B]">🏆 Мои одобренные сессии</p>
          </div>
          <div class="divide-y divide-[#F3F4F6]">
            @for (stat of moduleStats; track stat.moduleId) {
              <div>
                <button class="w-full px-5 py-3 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors"
                  (click)="stat.expanded = !stat.expanded">
                  <div class="text-left">
                    <p class="text-sm font-medium text-[#1A1A1B]">
                      <span class="text-[#6B7280]">{{ stat.courseCode }}</span>
                      · М{{ stat.moduleNumber }} — {{ stat.moduleTitle }}
                    </p>
                    <p class="text-xs text-[#9CA3AF]">{{ stat.courseTitle }}</p>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <div class="w-7 h-7 rounded-full bg-[#EAF2FF] flex items-center justify-center">
                      <span class="text-xs font-bold text-[#005BFF]">{{ stat.count }}</span>
                    </div>
                    <span class="text-[#9CA3AF] text-xs">{{ stat.expanded ? '▲' : '▼' }}</span>
                  </div>
                </button>
                @if (stat.expanded) {
                  <div class="px-5 pb-3 space-y-1.5 bg-[#FAFAFA]">
                    @for (s of stat.sessions; track s.id) {
                      <div class="flex items-center justify-between text-xs py-1">
                        <span class="text-[#1A1A1B]">{{ s.activityTitle }}</span>
                        <span class="text-[#6B7280]">{{ fmtDate(s.activityStartsAt) }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Teacher: mark attendance intent on sessions (B6) -->
      @if (isTeacher && teacherSessions.length > 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E5E7EB]">
            <p class="text-sm font-semibold text-[#1A1A1B]">Отметиться на паре</p>
            <p class="text-xs text-[#6B7280] mt-0.5">Отметьте занятия, где будете ассистентом. Вас можно будет назначить команде.</p>
          </div>
          <div class="divide-y divide-[#F3F4F6]">
            @for (a of teacherSessions; track a.id) {
              <div class="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm text-[#1A1A1B]">{{ a.title }}</p>
                  <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ a.typeLabel }} · {{ fmtDate(a.startsAt) }}</p>
                </div>
                @if (markedActivityIds.has(a.id)) {
                  <button (click)="cancelAttend(a.id)"
                    class="h-8 px-3 rounded-lg border border-[#6EE7B7] bg-[#D1FAE5] text-[#059669] text-xs font-medium hover:bg-[#A7F3D0] transition-colors whitespace-nowrap">
                    ✓ Буду · отменить
                  </button>
                } @else {
                  <button (click)="attendSession(a.id)"
                    class="h-8 px-3 rounded-lg bg-[#7C3AED] text-white text-xs font-medium hover:bg-[#6D28D9] transition-colors whitespace-nowrap">
                    Отметиться
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Pending applications (#12) -->
      @if (pendingActivities.length > 0) {
        <div class="bg-white rounded-xl border border-[#FDE68A] overflow-hidden">
          <div class="px-5 py-3 border-b border-[#FDE68A]">
            <p class="text-sm font-semibold text-[#D97706]">⏳ Ожидает одобрения</p>
          </div>
          <div class="divide-y divide-[#FEF9F0]">
            @for (a of pendingActivities; track a.id) {
              <div class="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm text-[#1A1A1B]">{{ a.title }}</p>
                  <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ a.typeLabel }} · {{ fmtDate(a.startsAt) }}</p>
                </div>
                <button (click)="cancel(a.id)"
                  class="h-8 px-3 rounded-lg border border-[#E5E7EB] text-xs text-[#DC2626] font-medium hover:border-[#DC2626] transition-colors whitespace-nowrap">
                  Отменить
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- Rejected applications -->
      @if (rejectedActivities.length > 0) {
        <div class="bg-white rounded-xl border border-[#FEE2E2] overflow-hidden">
          <div class="px-5 py-3 border-b border-[#FEE2E2]">
            <p class="text-sm font-semibold text-[#DC2626]">❌ Отклонённые заявки</p>
          </div>
          <div class="divide-y divide-[#FEF2F2]">
            @for (a of rejectedActivities; track a.id) {
              <div class="px-5 py-3 flex items-center justify-between">
                <div>
                  <p class="text-sm text-[#1A1A1B]">{{ a.title }}</p>
                  <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ fmtDate(a.startsAt) }}</p>
                </div>
                <span class="text-xs text-[#DC2626] bg-[#FEE2E2] px-2 py-1 rounded-md">Отклонено</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Apply to activities -->
      @if (availableToApply.length > 0 || (!loading && activities.length === 0)) {
        <div class="space-y-3">
          <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Подать заявку на занятие</p>

          @if (availableToApply.length === 0 && !loading) {
            <div class="bg-white rounded-xl border border-dashed border-[#E5E7EB] p-8 text-center">
              <p class="text-2xl mb-2">📭</p>
              <p class="text-sm text-[#6B7280]">Нет доступных занятий</p>
              <a routerLink="/courses" class="text-xs text-[#005BFF] font-medium hover:underline mt-2 block">Перейти к курсам →</a>
            </div>
          }

          @for (a of availableToApply; track a.id) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 bg-[#F3F4F6]">
                    {{ a.type === 2 ? '📝' : '📖' }}
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-[#1A1A1B]">{{ a.title }}</p>
                    <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ a.typeLabel }} · {{ fmtDate(a.startsAt) }}</p>
                  </div>
                </div>
                <span class="text-xs text-[#D97706] bg-[#FEF3C7] px-2.5 py-1 rounded-full flex-shrink-0 font-medium">{{ fmtCountdown(a.startsAt) }}</span>
              </div>

              @if (appStates[a.id]; as state) {
                @if (state.done && state.status === 'pending') {
                  <div class="flex items-center gap-2 bg-[#F0FDF4] rounded-lg px-3 py-2">
                    <span class="text-[#059669]">✓</span>
                    <p class="text-xs text-[#059669] font-medium">Заявка подана — ожидайте подтверждения</p>
                  </div>
                } @else {
                  <div class="flex gap-2">
                    <input type="text" placeholder="Комментарий (необязательно)"
                      [(ngModel)]="state.message"
                      class="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#7C3AED]" />
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
      }

      <!-- Hint -->
      <div class="bg-[#F5F3FF] rounded-xl border border-[#DDD6FE] px-5 py-4">
        @if (isTeacher) {
          <p class="text-xs text-[#7C3AED] leading-relaxed">
            💡 Вы преподаватель — у вас есть права ассистента на всех занятиях без подачи заявки.
            Активные занятия появляются в блоке «Идёт сейчас», нажмите «Войти», чтобы вести приём.
          </p>
        } @else {
          <p class="text-xs text-[#7C3AED] leading-relaxed">
            💡 После одобрения заявки преподавателем сессия появится в блоке «Идёт сейчас». Вы также получите уведомление.
          </p>
        }
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
  // B6 — занятия, на которых преподаватель отметился ассистентом (approved-заявка)
  markedActivityIds = new Set<string>();
  // C11 — занятия, на которые ассистент одобрен/назначен (можно входить и вести приём)
  approvedActivityIds = new Set<string>();

  // Будущие/идущие занятия для преподавателя (отметиться «буду на паре»)
  get teacherSessions() {
    const now = Date.now();
    return this.activities
      .filter(a => a.status !== 'Finished' && new Date(a.endsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  get isTeacher() { return this.auth.isTeacher(); }
  // Войти в активную пару можно только если занятие одобрено/назначено (препод — везде).
  private canEnter(a: StudentActivity) { return this.isTeacher || this.approvedActivityIds.has(a.id); }
  get activeLectures() { return this.activities.filter(a => a.status === 'Active' && a.type !== 2 && this.canEnter(a)); }
  get activeKts()      { return this.activities.filter(a => a.status === 'Active' && a.type === 2 && this.canEnter(a)); }
  get totalSessions()  { return this.moduleStats.reduce((s, m) => s + m.count, 0); }

  // Only show "apply" for activities where application is NOT approved/pending,
  // and that are not finished/in the past (#8).
  get availableToApply() {
    const now = Date.now();
    return this.activities.filter(a => {
      const st = this.appStates[a.id];
      if (!st || st.status !== 'none') return false;
      return a.status !== 'Finished' && new Date(a.endsAt).getTime() > now;
    });
  }

  // #12 — заявки, ожидающие одобрения (можно отменить).
  get pendingActivities() {
    return this.activities.filter(a => this.appStates[a.id]?.status === 'pending');
  }

  get rejectedActivities() {
    return this.activities.filter(a => this.appStates[a.id]?.status === 'rejected');
  }

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading = true;
    try {
      const [acts, sessions] = await Promise.all([
        this.api.myActivities().catch(() => [] as StudentActivity[]),
        this.api.mySessions()
      ]);

      // #13 — преподаватель является ассистентом на всех занятиях автоматически;
      // у него нет «записи на курс», поэтому список занятий берём из mySessions.
      this.activities = this.isTeacher
        ? sessions.map(s => ({
            id: s.activityId,
            title: s.activityTitle,
            type: s.activityType === 'ControlPoint' ? 2 : s.activityType === 'HomeworkSession' ? 3 : 1,
            typeLabel: s.activityType === 'ControlPoint' ? 'КТ' : s.activityType === 'HomeworkSession' ? 'ДЗ-сессия' : 'Лекция',
            status: s.activityStatus ?? 'Scheduled',
            startsAt: s.activityStartsAt,
            endsAt: s.activityStartsAt,
            courseCode: s.courseCode,
            courseTitle: s.courseTitle,
            moduleTitle: s.moduleTitle,
          } as StudentActivity))
        : acts;

      // B6 — какие занятия преподаватель уже отметил «буду на паре» (approved-заявка)
      if (this.isTeacher) {
        try {
          const myApps = await this.api.myApplications();
          this.markedActivityIds = new Set(myApps.filter(a => a.status === 'Approved').map(a => a.activityId));
        } catch { this.markedActivityIds = new Set(); }
      }

      // Build module stats with session details
      const map = new Map<string, ModuleStat>();
      for (const s of sessions) {
        if (!map.has(s.moduleId)) {
          map.set(s.moduleId, {
            moduleNumber: s.moduleNumber, moduleTitle: s.moduleTitle,
            courseCode: s.courseCode, courseTitle: s.courseTitle,
            count: 0, moduleId: s.moduleId,
            sessions: [], expanded: false
          });
        }
        const stat = map.get(s.moduleId)!;
        stat.count++;
        stat.sessions.push(s);
      }
      this.moduleStats = Array.from(map.values())
        .sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.moduleNumber - b.moduleNumber);

      // Load existing applications for each activity to set correct state
      this.approvedActivityIds = new Set(sessions.map(s => s.activityId));
      const approvedActivityIds = this.approvedActivityIds;

      for (const a of acts) {
        if (approvedActivityIds.has(a.id)) {
          this.appStates[a.id] = { message: '', submitting: false, done: true, status: 'approved' };
        } else {
          // Try to find pending/rejected application
          this.appStates[a.id] = { message: '', submitting: false, done: false, status: 'none' };
        }
      }

      // Load pending applications from backend for each activity
      await Promise.allSettled(acts.map(a =>
        this.api.listApplications(a.id).then(apps => {
          const myId = this.auth.user()?.id;
          const mine = apps.find(app => app.assistantId === myId);
          if (mine) {
            const status: AppStatus = mine.status === 'Approved' ? 'approved'
              : mine.status === 'Rejected' ? 'rejected' : 'pending';
            this.appStates[a.id] = { message: '', submitting: false, done: true, status };
          }
        }).catch(() => {})
      ));

    } catch { /* ignore */ }
    finally { this.loading = false; }
  }

  async apply(activityId: string) {
    const state = this.appStates[activityId];
    if (!state) return;
    state.submitting = true;
    try {
      await this.api.applyAssistant(activityId, state.message || undefined);
      this.toast.success('Заявка подана! Ожидайте подтверждения.');
      state.done = true;
      state.status = 'pending';
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      if (msg.includes('Already applied')) { state.done = true; state.status = 'pending'; this.toast.info('Заявка уже подана'); }
      else this.toast.error(msg);
    } finally { state.submitting = false; }
  }

  // B6 — преподаватель отмечается ассистентом на занятии (auto-approved, отменяемо)
  async attendSession(activityId: string) {
    try {
      await this.api.applyAssistant(activityId);
      this.markedActivityIds.add(activityId);
      this.toast.success('Вы отмечены ассистентом на этом занятии');
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }
  async cancelAttend(activityId: string) {
    try {
      await this.api.cancelApplication(activityId);
      this.markedActivityIds.delete(activityId);
      this.toast.info('Отметка снята');
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async cancel(activityId: string) {
    const state = this.appStates[activityId];
    if (!state) return;
    try {
      await this.api.cancelApplication(activityId);
      this.toast.success('Заявка отменена');
      state.status = 'none';
      state.done = false;
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  fmtDate(d: string) { return new Date(d).toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }

  fmtCountdown(d: string) {
    const diff = new Date(d).getTime() - Date.now();
    if (diff <= 0) return 'завершено';
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
