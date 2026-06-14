import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { StudentActivity } from '../../core/models';
import { activityTypeIcon } from '../../core/activity-type';

interface DayCell { date: Date; isToday: boolean; activities: StudentActivity[]; }

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4 max-w-5xl">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-[#1A1A1B]">Календарь занятий</h1>
        <div class="flex items-center gap-2">
          <button (click)="prevWeek()" [class]="navBtn">←</button>
          <button (click)="today()" class="h-8 px-3 rounded-lg border border-[#E5E7EB] text-xs font-medium text-[#6B7280] hover:border-[#005BFF] hover:text-[#005BFF] transition-colors">Сегодня</button>
          <button (click)="nextWeek()" [class]="navBtn">→</button>
        </div>
      </div>

      <p class="text-sm text-[#6B7280]">{{ weekLabel }}</p>

      @if (loading) {
        <p class="text-sm text-[#6B7280] animate-pulse">Загрузка...</p>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-7 gap-2">
          @for (d of days; track d.date.getTime()) {
            <div class="bg-white rounded-xl border p-2 min-h-32"
              [class]="d.isToday ? 'border-[#005BFF]' : 'border-[#E5E7EB]'">
              <div class="flex items-center justify-between mb-2 px-1">
                <span class="text-xs font-semibold" [class]="d.isToday ? 'text-[#005BFF]' : 'text-[#1A1A1B]'">
                  {{ d.date | date:'EEE' }}
                </span>
                <span class="text-xs" [class]="d.isToday ? 'text-[#005BFF]' : 'text-[#9CA3AF]'">
                  {{ d.date | date:'d MMM' }}
                </span>
              </div>
              <div class="space-y-1.5">
                @for (a of d.activities; track a.id) {
                  <button (click)="open(a)"
                    class="w-full text-left rounded-lg px-2 py-1.5 transition-colors hover:shadow-sm"
                    [class]="cellClass(a)">
                    <div class="flex items-center gap-1">
                      <span class="text-xs">{{ icon(a.type) }}</span>
                      <span class="text-[11px] font-medium truncate">{{ a.title }}</span>
                    </div>
                    <div class="flex items-center justify-between mt-0.5">
                      <span class="text-[10px] opacity-70">{{ a.startsAt | date:'HH:mm' }} · {{ a.courseCode }}</span>
                      @if (a.status === 'Finished') {
                        <span class="text-[9px] font-semibold px-1 rounded bg-[#E5E7EB] text-[#6B7280]">завершено</span>
                      } @else if (a.status === 'Active') {
                        <span class="text-[9px] font-semibold px-1 rounded bg-[#D1FAE5] text-[#059669]">идёт</span>
                      }
                    </div>
                  </button>
                }
                @if (d.activities.length === 0) {
                  <p class="text-[10px] text-[#D1D5DB] px-1">—</p>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class CalendarComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly navBtn = 'w-8 h-8 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] hover:border-[#005BFF] hover:text-[#005BFF] transition-colors';

  all: StudentActivity[] = [];
  days: DayCell[] = [];
  weekStart = this.startOfWeek(new Date());
  loading = true;

  get weekLabel() {
    const end = new Date(this.weekStart); end.setDate(end.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
    return `${f(this.weekStart)} — ${f(end)}`;
  }

  async ngOnInit() {
    try { this.all = await this.api.calendar(); }
    catch { this.all = []; }
    finally { this.loading = false; this.buildWeek(); }
  }

  startOfWeek(d: Date) {
    const date = new Date(d); date.setHours(0, 0, 0, 0);
    const day = (date.getDay() + 6) % 7; // Monday = 0
    date.setDate(date.getDate() - day);
    return date;
  }

  buildWeek() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    this.days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(this.weekStart); date.setDate(date.getDate() + i);
      const next = new Date(date); next.setDate(next.getDate() + 1);
      const activities = this.all
        .filter(a => { const t = new Date(a.startsAt); return t >= date && t < next; })
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      return { date, isToday: date.getTime() === today.getTime(), activities };
    });
  }

  prevWeek() { this.weekStart.setDate(this.weekStart.getDate() - 7); this.weekStart = new Date(this.weekStart); this.buildWeek(); }
  nextWeek() { this.weekStart.setDate(this.weekStart.getDate() + 7); this.weekStart = new Date(this.weekStart); this.buildWeek(); }
  today() { this.weekStart = this.startOfWeek(new Date()); this.buildWeek(); }

  icon(type: number) { return activityTypeIcon(type); }

  cellClass(a: StudentActivity) {
    if (a.status === 'Finished') return 'bg-[#F3F4F6] text-[#9CA3AF]';
    if (a.type === 2) return 'bg-[#FEF3C7] text-[#D97706]';      // КТ
    if (a.type === 3) return 'bg-[#F3E8FF] text-[#7C3AED]';      // ДЗ-сессия
    return 'bg-[#EAF2FF] text-[#005BFF]';                          // Лекция
  }

  open(a: StudentActivity) {
    const path = a.type === 2 ? ['/kt', a.id] : ['/lecture', a.id];
    this.router.navigate(path);
  }
}
