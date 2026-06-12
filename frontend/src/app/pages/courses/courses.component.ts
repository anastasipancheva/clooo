import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Course, TemplateSummary } from '../../core/models';

function defaultYear() {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 max-w-2xl">

      <!-- Header row -->
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-[#1A1A1B]">Курсы</h1>
        @if (auth.isTeacher() && templates.length > 0) {
          <button (click)="openTplModal()"
            class="h-8 px-4 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold hover:bg-[#6D28D9] transition-colors">
            📋 Создать по шаблону
          </button>
        }
      </div>

      <!-- Enrolled courses -->
      @if (enrolledCourses.length > 0) {
        <div class="space-y-3">
          <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Мои курсы</p>
          @for (c of enrolledCourses; track c.id) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-[#1A1A1B]">{{ c.code }} — {{ c.title }}</p>
                <p class="text-xs text-[#6B7280]">{{ c.academicYear }}</p>
              </div>
              <span class="flex items-center gap-1.5 text-xs text-[#059669] font-medium bg-[#D1FAE5] px-2.5 py-1 rounded-full">✓ Записан</span>
            </div>
          }
        </div>
      }

      <!-- Not enrolled -->
      @if (notEnrolledCourses.length > 0 && !auth.isTeacher()) {
        <div class="space-y-3">
          <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Доступные курсы</p>
          <div class="bg-[#F5F3FF] rounded-xl border border-[#DDD6FE] px-4 py-3">
            <p class="text-xs text-[#7C3AED]">💡 Для записи на курс вам нужна ссылка-приглашение от преподавателя.</p>
          </div>
          @for (c of notEnrolledCourses; track c.id) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center justify-between opacity-70">
              <div>
                <p class="text-sm font-semibold text-[#1A1A1B]">{{ c.code }} — {{ c.title }}</p>
                <p class="text-xs text-[#6B7280]">{{ c.academicYear }}</p>
              </div>
              <span class="text-xs text-[#9CA3AF] font-medium">Нет доступа</span>
            </div>
          }
        </div>
      }

      @if (courseList.length === 0 && !loading()) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p class="text-4xl mb-3">📖</p>
          <p class="text-sm text-[#9CA3AF]">Нет доступных курсов</p>
        </div>
      }

      <!-- Teacher: all courses list -->
      @if (auth.isTeacher() && courseList.length > 0) {
        <div class="space-y-3">
          @for (c of courseList; track c.id) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-[#1A1A1B]">{{ c.code }} — {{ c.title }}</p>
                  <p class="text-xs text-[#6B7280]">{{ c.academicYear }}</p>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Template apply modal -->
      @if (tplModal) {
        <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" (click)="tplModal = false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" (click)="$event.stopPropagation()">
            <p class="text-base font-semibold text-[#1A1A1B]">Создать курс по шаблону</p>

            <div>
              <label class="block text-xs text-[#6B7280] mb-1">Шаблон</label>
              <select class="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#7C3AED]"
                [(ngModel)]="tplId">
                <option value="">— выберите шаблон —</option>
                @for (t of templates; track t.id) {
                  <option [value]="t.id">{{ t.title }}</option>
                }
              </select>
            </div>

            <div>
              <label class="block text-xs text-[#6B7280] mb-1">Код курса *</label>
              <input class="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#7C3AED]"
                [(ngModel)]="tplCode" placeholder="напр. WEB-2025" />
            </div>

            <div>
              <label class="block text-xs text-[#6B7280] mb-1">Название курса *</label>
              <input class="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#7C3AED]"
                [(ngModel)]="tplTitle" placeholder="напр. Веб-разработка" />
            </div>

            <div>
              <label class="block text-xs text-[#6B7280] mb-1">Учебный год</label>
              <input class="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#7C3AED]"
                [(ngModel)]="tplYear" placeholder="2025/2026" />
            </div>

            <div class="flex gap-3 pt-2">
              <button (click)="tplModal = false"
                class="flex-1 h-9 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] hover:border-[#D1D5DB]">
                Отмена
              </button>
              <button (click)="applyTemplate()" [disabled]="applying() || !tplId || !tplCode || !tplTitle"
                class="flex-1 h-9 rounded-lg bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] disabled:opacity-60 transition-colors">
                {{ applying() ? '⏳ Создание...' : 'Создать' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class CoursesComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  courseList: Course[] = [];
  templates: TemplateSummary[] = [];
  loading = signal<string | null>(null);
  applying = signal(false);

  tplModal = false;
  tplId = '';
  tplCode = '';
  tplTitle = '';
  tplYear = defaultYear();

  get enrolledCourses() { return this.courseList.filter(c => c.isEnrolled); }
  get notEnrolledCourses() { return this.courseList.filter(c => !c.isEnrolled); }

  ngOnInit() {
    this.api.listCourses().then(c => this.courseList = c).catch(() => {});
    if (this.auth.isTeacher()) {
      this.api.listTemplates().then(t => this.templates = t).catch(() => {});
    }
  }

  openTplModal() {
    this.tplId = '';
    this.tplCode = '';
    this.tplTitle = '';
    this.tplYear = defaultYear();
    this.tplModal = true;
  }

  async applyTemplate() {
    if (!this.tplId || !this.tplCode || !this.tplTitle) return;
    this.applying.set(true);
    try {
      await this.api.applyTemplate(this.tplId, {
        courseCode: this.tplCode,
        courseTitle: this.tplTitle,
        academicYear: this.tplYear
      });
      this.toast.success('Курс создан по шаблону!');
      this.tplModal = false;
      this.courseList = await this.api.listCourses();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      this.applying.set(false);
    }
  }
}
