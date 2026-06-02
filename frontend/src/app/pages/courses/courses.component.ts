import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Course } from '../../core/models';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6 max-w-2xl">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">Курсы</h1>
      @if (courseList.length === 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p class="text-4xl mb-3">📖</p>
          <p class="text-sm text-[#9CA3AF]">Нет доступных курсов</p>
        </div>
      }
      <div class="space-y-3">
        @for (c of courseList; track c.id) {
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-[#1A1A1B]">{{ c.code }} — {{ c.title }}</p>
              <p class="text-xs text-[#6B7280]">{{ c.academicYear }}</p>
            </div>
            @if (enrolled.has(c.id)) {
              <span class="flex items-center gap-1.5 text-xs text-[#059669] font-medium">✓ Записан</span>
            } @else {
              <button (click)="enroll(c.id)" [disabled]="loading() === c.id"
                class="h-8 px-4 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] disabled:opacity-60 transition-colors">
                {{ loading() === c.id ? '...' : 'Записаться' }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class CoursesComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  courseList: Course[] = [];
  enrolled = new Set<string>();
  loading = signal<string | null>(null);

  ngOnInit() {
    this.api.listCourses().then(c => {
      this.courseList = c;
      // Pre-populate enrollment set from server response
      c.forEach(course => { if (course.isEnrolled) this.enrolled.add(course.id); });
    }).catch(() => {});
  }

  async enroll(courseId: string) {
    this.loading.set(courseId);
    try {
      await this.api.enrollCourse(courseId);
      this.enrolled.add(courseId);
      this.toast.success('Вы записаны на курс');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      if (msg.includes('Already enrolled')) { this.enrolled.add(courseId); this.toast.info('Вы уже записаны на этот курс'); }
      else this.toast.error(msg);
    } finally {
      this.loading.set(null);
    }
  }
}
