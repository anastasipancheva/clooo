import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { StudentActivity, Course } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CommonModule],
  template: `
    <div class="space-y-6 max-w-3xl">
      <div class="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] px-6 py-5">
        <p class="text-sm text-[#005BFF] font-medium mb-0.5">Добро пожаловать</p>
        <h1 class="text-xl font-semibold text-[#1A1A1B]">{{ auth.user()?.displayName }}</h1>
        <p class="text-sm text-[#6B7280] mt-0.5">{{ auth.isAssistant() ? 'Ассистент' : 'Студент' }}</p>
      </div>

      @if (active.length > 0) {
        <div class="space-y-2">
          <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">⚡ Сейчас идёт</p>
          @for (a of active; track a.id) {
            <a [routerLink]="activityHref(a)"
               class="bg-white rounded-xl border-2 border-[#005BFF]/20 p-4 flex items-center justify-between hover:border-[#005BFF]/40 transition-colors block">
              <div>
                <p class="text-sm font-semibold text-[#1A1A1B]">{{ a.title }}</p>
                <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ a.typeLabel }}</p>
              </div>
              <span class="flex items-center gap-1 text-xs font-medium text-[#005BFF] bg-[#EAF2FF] px-3 py-1.5 rounded-lg">Перейти →</span>
            </a>
          }
        </div>
      }

      @if (upcoming.length > 0) {
        <div class="space-y-2">
          <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Предстоящие занятия</p>
          @for (a of upcoming; track a.id) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-[#1A1A1B]">{{ a.title }}</p>
                <p class="text-xs text-[#6B7280]">{{ a.courseCode }} · {{ a.typeLabel }} · {{ fmtDate(a.startsAt) }}</p>
              </div>
              <span class="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-1 rounded-md">Запланировано</span>
            </div>
          }
        </div>
      }

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        @if (!auth.isAssistant()) {
          <a routerLink="/scores" class="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:border-[#005BFF]/30 transition-all block">
            <div class="w-8 h-8 rounded-lg bg-[#005BFF]/10 flex items-center justify-center mb-2">⭐</div>
            <p class="text-sm font-medium text-[#1A1A1B]">Мои баллы</p>
          </a>
        }
        <a routerLink="/notifications" class="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:border-[#005BFF]/30 transition-all block">
          <div class="w-8 h-8 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center mb-2">🔔</div>
          <p class="text-sm font-medium text-[#1A1A1B]">Уведомления</p>
        </a>
        @if (!auth.isAssistant()) {
          <a routerLink="/homework" class="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:border-[#005BFF]/30 transition-all block">
            <div class="w-8 h-8 rounded-lg bg-[#059669]/10 flex items-center justify-center mb-2">📖</div>
            <p class="text-sm font-medium text-[#1A1A1B]">Домашние задания</p>
          </a>
        }
        <a routerLink="/courses" class="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:border-[#005BFF]/30 transition-all block">
          <div class="w-8 h-8 rounded-lg bg-[#D97706]/10 flex items-center justify-center mb-2">📋</div>
          <p class="text-sm font-medium text-[#1A1A1B]">Мои курсы</p>
        </a>
      </div>

      @if (active.length === 0 && upcoming.length === 0 && courseList.length === 0 && auth.isStudent()) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p class="text-sm text-[#6B7280] mb-3">Вы ещё не записаны ни на один курс</p>
          <a routerLink="/courses" class="text-sm text-[#005BFF] font-medium hover:underline">Перейти к списку курсов →</a>
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

  get active() { return this.activities.filter(a => a.status === 'Active'); }
  get upcoming() { return this.activities.filter(a => a.status === 'Scheduled').slice(0, 5); }

  ngOnInit() {
    if (this.auth.isTeacher()) { this.router.navigate(['/admin']); return; }
    this.api.myActivities().then(a => this.activities = a).catch(() => {});
    this.api.listCourses().then(c => this.courseList = c).catch(() => {});
  }

  activityHref(a: StudentActivity) { return a.type === 2 ? `/kt/${a.id}` : `/lecture/${a.id}`; }
  fmtDate(d: string) { return new Date(d).toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
}
