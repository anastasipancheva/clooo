import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { StudentActivity, Course, StudentScore } from '../../core/models';
import { activityTypeIcon, activityTypeIconBg } from '../../core/activity-type';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CommonModule],
  template: `
    <div class="space-y-6 max-w-3xl">

      <!-- Welcome card -->
      <div class="bg-gradient-to-r from-[#005BFF] to-[#3B82F6] rounded-2xl px-6 py-5 text-white">
        <p class="text-sm font-medium opacity-80 mb-0.5">Добро пожаловать</p>
        <h1 class="text-xl font-bold">{{ auth.user()?.displayName }}</h1>
        <p class="text-sm opacity-70 mt-0.5">
          {{ auth.isAssistant() ? 'Ассистент' : 'Студент' }}
          @if (enrolledCount > 0) { · {{ enrolledCount }} {{ plural(enrolledCount, 'курс', 'курса', 'курсов') }} }
        </p>
      </div>

      <!-- Active right now -->
      @if (active.length > 0) {
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[#059669] animate-pulse"></span>
            <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Идёт сейчас</p>
          </div>
          @for (a of active; track a.id) {
            <a [routerLink]="activityHref(a)"
               class="bg-white rounded-xl border-2 border-[#005BFF]/30 p-4 flex items-center justify-between hover:border-[#005BFF]/60 hover:shadow-sm transition-all block">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  [class]="actIconBg(a.type)">{{ actIcon(a.type) }}</div>
                <div>
                  <p class="text-sm font-semibold text-[#1A1A1B]">{{ a.title }}</p>
                  <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ a.moduleTitle }} · до {{ fmtTime(a.endsAt) }}</p>
                </div>
              </div>
              <span class="flex items-center gap-1 text-xs font-semibold text-white bg-[#005BFF] px-3 py-1.5 rounded-lg flex-shrink-0">
                Войти →
              </span>
            </a>
          }
        </div>
      }

      <!-- Upcoming -->
      @if (upcoming.length > 0) {
        <div class="space-y-2">
          <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Предстоящие занятия</p>
          @for (a of upcoming; track a.id) {
            <a [routerLink]="activityHref(a)"
               class="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center justify-between hover:border-[#005BFF]/40 hover:shadow-sm transition-all block">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  [class]="actIconBg(a.type)">{{ actIcon(a.type) }}</div>
                <div>
                  <p class="text-sm font-medium text-[#1A1A1B]">{{ a.title }}</p>
                  <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ fmtDate(a.startsAt) }}</p>
                </div>
              </div>
              <span class="text-xs text-[#D97706] bg-[#FEF3C7] px-2 py-1 rounded-md font-medium">{{ fmtCountdown(a.startsAt) }}</span>
            </a>
          }
        </div>
      }

      <!-- Score summary per course -->
      @if (!auth.isAssistant() && scoresByCourse.length > 0) {
        <div class="space-y-2">
          <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Мои баллы</p>
          @for (cs of scoresByCourse; track cs.courseId) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div class="px-4 py-3 border-b border-[#F3F4F6] flex items-center justify-between">
                <p class="text-sm font-semibold text-[#1A1A1B]">{{ cs.courseCode }} — {{ cs.courseTitle }}</p>
                @if (cs.finalScore > 0) {
                  <span class="text-sm font-bold px-2 py-0.5 rounded-lg" [class]="markColor(cs.mark)">{{ cs.mark }}</span>
                }
              </div>
              <div class="px-4 py-3 flex flex-wrap gap-3">
                @for (m of cs.modules; track m.moduleNumber) {
                  <div class="text-center">
                    <p class="text-[10px] text-[#9CA3AF]">М{{ m.moduleNumber }}</p>
                    <p class="text-sm font-bold" [class]="m.moduleScore > 0 ? 'text-[#005BFF]' : 'text-[#D1D5DB]'">
                      {{ m.moduleScore > 0 ? m.moduleScore.toFixed(1) : '—' }}
                    </p>
                  </div>
                }
                @if (cs.modules.length === 0) {
                  <p class="text-xs text-[#9CA3AF]">Нет данных</p>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Quick links -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        @if (!auth.isAssistant()) {
          <a routerLink="/scores" class="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:border-[#005BFF]/30 hover:shadow-sm transition-all block text-center">
            <div class="w-9 h-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center mb-2 mx-auto text-lg">⭐</div>
            <p class="text-xs font-semibold text-[#1A1A1B]">Баллы</p>
          </a>
        }
        <a routerLink="/notifications" class="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:border-[#7C3AED]/30 hover:shadow-sm transition-all block text-center">
          <div class="w-9 h-9 rounded-xl bg-[#F3E8FF] flex items-center justify-center mb-2 mx-auto text-lg relative">
            🔔
            @if (unread > 0) {
              <span class="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full text-white text-[9px] font-bold flex items-center justify-center">{{ unread }}</span>
            }
          </div>
          <p class="text-xs font-semibold text-[#1A1A1B]">Уведомления</p>
        </a>
        @if (!auth.isAssistant()) {
          <a routerLink="/homework" class="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:border-[#059669]/30 hover:shadow-sm transition-all block text-center">
            <div class="w-9 h-9 rounded-xl bg-[#D1FAE5] flex items-center justify-center mb-2 mx-auto text-lg">📖</div>
            <p class="text-xs font-semibold text-[#1A1A1B]">Домашние задания</p>
          </a>
        }
        <a routerLink="/courses" class="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:border-[#D97706]/30 hover:shadow-sm transition-all block text-center">
          <div class="w-9 h-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center mb-2 mx-auto text-lg">📋</div>
          <p class="text-xs font-semibold text-[#1A1A1B]">Курсы</p>
        </a>
        @if (auth.isAssistant()) {
          <a routerLink="/assistant" class="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:border-[#005BFF]/30 hover:shadow-sm transition-all block text-center">
            <div class="w-9 h-9 rounded-xl bg-[#EAF2FF] flex items-center justify-center mb-2 mx-auto text-lg">🎓</div>
            <p class="text-xs font-semibold text-[#1A1A1B]">Мои сессии</p>
          </a>
        }
      </div>

      <!-- Empty state -->
      @if (active.length === 0 && upcoming.length === 0 && courseList.length === 0 && !loading) {
        <div class="bg-white rounded-xl border border-dashed border-[#E5E7EB] p-10 text-center">
          <p class="text-2xl mb-3">🎓</p>
          <p class="text-sm font-medium text-[#1A1A1B] mb-1">Вы ещё не записаны на курсы</p>
          <p class="text-xs text-[#6B7280] mb-4">Запишитесь на курс чтобы видеть расписание и баллы</p>
          <a routerLink="/courses" class="inline-flex items-center gap-1 text-sm text-[#005BFF] font-medium hover:underline">Перейти к курсам →</a>
        </div>
      }
    </div>
  `
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  activities: StudentActivity[] = [];
  courseList: Course[] = [];
  allScores: Map<string, StudentScore[]> = new Map();
  unread = 0;
  loading = true;

  get active() { return this.activities.filter(a => a.status === 'Active'); }
  // #6 — «предстоящие»: только запланированные и ещё не прошедшие (не завершённые).
  get upcoming() {
    const now = Date.now();
    return this.activities
      .filter(a => a.status === 'Scheduled' && new Date(a.endsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 4);
  }

  get enrolledCount() { return this.courseList.filter(c => c.isEnrolled).length; }

  get scoresByCourse() {
    return this.courseList.filter(c => c.isEnrolled).map(c => {
      const scores = this.allScores.get(c.id) ?? [];
      const myId = this.auth.user()?.id;
      const me = scores.find(s => s.studentId === myId);
      return {
        courseId: c.id, courseCode: c.code, courseTitle: c.title,
        modules: me?.modules ?? [],
        finalScore: me?.finalScore ?? 0,
        mark: me?.mark ?? ''
      };
    }).filter(cs => cs.modules.length > 0);
  }

  ngOnInit() {
    if (this.auth.isTeacher()) { this.router.navigate(['/admin']); return; }
    this.load();
  }

  async load() {
    this.loading = true;
    const [acts, courses, notifs] = await Promise.allSettled([
      this.api.myActivities(),
      this.api.listCourses(),
      this.api.listNotifications()
    ]);
    if (acts.status === 'fulfilled') this.activities = acts.value;
    if (courses.status === 'fulfilled') {
      this.courseList = courses.value;
      // load own scores for enrolled courses (студент тянет персональный эндпоинт)
      const myId = this.auth.user()?.id;
      if (!this.auth.isAssistant() && myId) {
        for (const c of courses.value.filter(c => c.isEnrolled)) {
          this.api.studentScore(c.id, myId).then(s => this.allScores.set(c.id, [s])).catch(() => {});
        }
      }
    }
    if (notifs.status === 'fulfilled') this.unread = notifs.value.filter(n => !n.readAt).length;
    this.loading = false;
  }

  activityHref(a: StudentActivity) {
    if (this.auth.isAssistant()) return a.type === 2 ? `/assistant/kt/${a.id}` : `/assistant/session/${a.id}`;
    return a.type === 2 ? `/kt/${a.id}` : `/lecture/${a.id}`;
  }

  actIcon(type: number) { return activityTypeIcon(type); }
  actIconBg(type: number) { return activityTypeIconBg(type); }

  fmtDate(d: string) { return new Date(d).toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  fmtTime(d: string) { return new Date(d).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }); }

  fmtCountdown(d: string) {
    const diff = new Date(d).getTime() - Date.now();
    if (diff <= 0) return 'завершено';
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `через ${days} д.`;
    const hrs = Math.floor(diff / 3600000);
    if (hrs > 0) return `через ${hrs} ч.`;
    return `через ${Math.floor(diff / 60000)} мин.`;
  }

  markColor(mark: string) {
    if (!mark) return 'text-[#6B7280] bg-[#F3F4F6]';
    if (mark.startsWith('5')) return 'text-[#059669] bg-[#D1FAE5]';
    if (mark.startsWith('4')) return 'text-[#005BFF] bg-[#EAF2FF]';
    if (mark.startsWith('3')) return 'text-[#D97706] bg-[#FEF3C7]';
    return 'text-[#DC2626] bg-[#FEE2E2]';
  }

  plural(n: number, one: string, few: string, many: string) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }
}
