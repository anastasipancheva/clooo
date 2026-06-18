import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Course, StudentScore } from '../../core/models';

@Component({
  selector: 'app-scores',
  standalone: true,
  imports: [RouterLink, CommonModule],
  template: `
    <div class="space-y-6 max-w-2xl">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">{{ isStaff ? 'Баллы' : 'Мои баллы' }}</h1>
      <div class="bg-white rounded-xl border border-[#E5E7EB] p-4">
        <p class="text-xs font-medium text-[#6B7280] mb-3 uppercase tracking-wide">Выберите курс</p>
        <div class="flex flex-wrap gap-2">
          @if (courseList.length === 0) {
            <div class="text-sm text-[#9CA3AF]">
              Вы не записаны ни на один курс.
              <a routerLink="/courses" class="text-[#005BFF] hover:underline ml-1">Перейти к курсам →</a>
            </div>
          }
          @for (c of courseList; track c.id) {
            <button (click)="selectCourse(c.id)"
              class="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              [class]="selected() === c.id ? 'bg-[#005BFF] text-white border-[#005BFF]' : 'bg-white text-[#1A1A1B] border-[#E5E7EB] hover:border-[#005BFF]/40'">
              {{ c.code }} — {{ c.title }}
            </button>
          }
        </div>
      </div>

      <!-- Assistant/teacher: full course scoreboard -->
      @if (isStaff && selected()) {
        @if (allScores().length === 0) {
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center text-sm text-[#9CA3AF]">Нет данных по баллам</div>
        } @else {
          <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <div class="px-5 py-3 border-b border-[#E5E7EB]"><span class="text-sm font-semibold text-[#1A1A1B]">Баллы потока</span></div>
            <div class="divide-y divide-[#F3F4F6]">
              @for (s of allScores(); track s.studentId) {
                <div class="px-5 py-3 flex items-center justify-between gap-3">
                  <span class="text-sm text-[#1A1A1B] truncate">{{ s.displayName }}</span>
                  <div class="flex items-center gap-3 shrink-0">
                    <span class="text-sm text-[#6B7280]">{{ s.finalScore.toFixed(1) }}</span>
                    <span class="text-xs font-bold px-2.5 py-1 rounded-full" [class]="markColor(s.mark)">{{ s.mark }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }

      @if (!isStaff && selected() && !score()) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center text-sm text-[#9CA3AF]">
          Нет данных по баллам
        </div>
      }

      @if (!isStaff && selected() && score(); as s) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <span class="text-sm font-semibold text-[#1A1A1B]">{{ s.displayName }}</span>
            <div class="flex items-center gap-3">
              <span class="text-sm text-[#6B7280]">Итог: <span class="font-semibold text-[#1A1A1B]">{{ s.finalScore.toFixed(1) }}</span></span>
              <span class="text-xs font-bold px-2.5 py-1 rounded-full" [class]="markColor(s.mark)">{{ s.mark }}</span>
            </div>
          </div>
          <div class="divide-y divide-[#F3F4F6]">
            @for (n of [1,2,3]; track n) {
              <div class="px-5 py-3.5 flex items-center justify-between">
                <span class="text-sm text-[#6B7280]">Модуль {{ n }}</span>
                <span class="text-sm font-semibold text-[#1A1A1B]">
                  {{ byModule(s, n) !== null ? byModule(s, n)!.toFixed(1) : '—' }}
                </span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class ScoresComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  courseList: Course[] = [];
  selected = signal<string | null>(null);
  score = signal<StudentScore | null>(null);
  allScores = signal<StudentScore[]>([]);

  get isStaff() { return this.auth.isAssistant() || this.auth.isTeacher(); }

  ngOnInit() {
    // Список курсов строим по факту записи (isEnrolled), а не по наличию незавершённых
    // занятий — иначе после завершения занятия курс пропадал из раздела «Баллы».
    this.api.listCourses()
      .then(courses => { this.courseList = courses.filter(c => c.isEnrolled); })
      .catch(() => { this.courseList = []; });
  }

  async selectCourse(id: string) {
    this.selected.set(this.selected() === id ? null : id);
    this.score.set(null);
    this.allScores.set([]);
    if (this.selected()) {
      if (this.isStaff) {
        const all = await this.api.courseScores(id).catch(() => [] as StudentScore[]);
        this.allScores.set(all);
      } else {
        const userId = this.auth.user()?.id;
        // Студент тянет свои баллы через персональный эндпоинт (courseScores доступен только персоналу).
        const mine = userId ? await this.api.studentScore(id, userId).catch(() => null) : null;
        this.score.set(mine ?? null);
      }
    }
  }

  byModule(s: StudentScore, n: number): number | null {
    return s.modules.find(m => m.moduleNumber === n)?.moduleScore ?? null;
  }

  markColor(mark: string) {
    if (mark.startsWith('5')) return 'text-[#059669] bg-[#D1FAE5]';
    if (mark.startsWith('4')) return 'text-[#005BFF] bg-[#EAF2FF]';
    if (mark.startsWith('3')) return 'text-[#D97706] bg-[#FEF3C7]';
    return 'text-[#DC2626] bg-[#FEE2E2]';
  }
}
