import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
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
            @if (c.isEnrolled) {
              <span class="flex items-center gap-1.5 text-xs text-[#059669] font-medium">✓ Записан</span>
            } @else {
              <span class="text-xs text-[#9CA3AF]">Запись через преподавателя</span>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class CoursesComponent implements OnInit {
  private api = inject(ApiService);

  courseList: Course[] = [];

  ngOnInit() {
    this.api.listCourses().then(c => { this.courseList = c; }).catch(() => {});
  }
}
