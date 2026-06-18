import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Course } from '../../core/models';

interface LectureCol { id: string; title: string; taskCodes: string[]; }
interface ModuleCol { number: number; lectures: LectureCol[]; hasKt: boolean; }
interface LectureVal { total: number; test: number; coef: number; tasks: Record<string, number>; }
interface ModuleVal { score: number; homework: number; ktCoef: number; ktPoints: number; lectures: Record<string, LectureVal>; }
interface RowVal { finalMark: string; weighted: number; raw: number; modules: Record<string, ModuleVal>; }
interface Gradebook {
  students: { id: string; name: string }[];
  modules: ModuleCol[];
  rows: Record<string, RowVal>;
}
type Field = 'name' | 'mark' | 'weighted' | 'raw' | 'moduleScore' | 'homework' | 'ktCoef' | 'ktPoints' | 'lecTotal' | 'lecCoef' | 'lecTest' | 'task';
interface Col {
  id: string; label: string; field: Field;
  moduleNum?: number; lecId?: string; taskCode?: string;
  toggle?: 'module' | 'lecture'; expanded?: boolean;
  border?: boolean;   // thick left border (group start)
}

@Component({
  selector: 'app-gradebook',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h1 class="text-lg font-semibold text-[#1A1A1B]">Ведомость</h1>
        <select [class]="'h-9 px-3 pr-8 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF]'"
          [(ngModel)]="courseId" (ngModelChange)="load()">
          <option value="">— выберите курс —</option>
          @for (c of courses; track c.id) { <option [value]="c.id">{{ c.code }} — {{ c.title }}</option> }
        </select>
      </div>

      @if (loading) { <p class="text-sm text-[#6B7280] animate-pulse">Загрузка...</p> }

      @if (!loading && data) {
        @if (data.students.length === 0) {
          <p class="text-sm text-[#9CA3AF]">На курсе нет студентов.</p>
        } @else {
          <p class="text-xs text-[#9CA3AF]">Кликните на «М…» чтобы развернуть модуль, на «Л…» — лекцию. ИО — итоговая оценка, БСК — баллы с коэффициентами, СБ — сырые баллы.</p>
          <div class="overflow-x-auto border border-[#E5E7EB] rounded-xl bg-white">
            <table class="text-xs border-collapse min-w-max">
              <thead>
                <tr class="bg-[#F9FAFB]">
                  @for (col of columns; track col.id) {
                    <th [class]="thClass(col)" (click)="onHeaderClick(col)">
                      {{ col.label }}@if (col.toggle) { <span class="text-[#9CA3AF]"> {{ col.expanded ? '▾' : '▸' }}</span> }
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (st of data.students; track st.id) {
                  <tr class="hover:bg-[#FAFBFF]">
                    @for (col of columns; track col.id) {
                      <td [class]="tdClass(col)">{{ cell(col, st.id) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `
})
export class GradebookComponent implements OnInit {
  private api = inject(ApiService);

  courses: Course[] = [];
  courseId = '';
  data: Gradebook | null = null;
  loading = false;
  expModules = new Set<number>();
  expLectures = new Set<string>();

  async ngOnInit() {
    this.courses = await this.api.listCourses().catch(() => [] as Course[]);
  }

  async load() {
    this.data = null;
    if (!this.courseId) return;
    this.loading = true;
    try { this.data = await this.api.gradebook(this.courseId); }
    catch { this.data = null; }
    finally { this.loading = false; }
  }

  onHeaderClick(col: Col) {
    if (col.toggle === 'module' && col.moduleNum != null) {
      this.expModules.has(col.moduleNum) ? this.expModules.delete(col.moduleNum) : this.expModules.add(col.moduleNum);
    } else if (col.toggle === 'lecture' && col.lecId) {
      this.expLectures.has(col.lecId) ? this.expLectures.delete(col.lecId) : this.expLectures.add(col.lecId);
    }
  }

  // Плоский список колонок по текущему состоянию разворачивания.
  get columns(): Col[] {
    const cols: Col[] = [
      { id: 'name', label: 'ФИО', field: 'name' },
      { id: 'mark', label: 'ИО', field: 'mark', border: true },
      { id: 'weighted', label: 'БСК', field: 'weighted' },
      { id: 'raw', label: 'СБ', field: 'raw' },
    ];
    if (!this.data) return cols;
    for (const m of this.data.modules) {
      const mExp = this.expModules.has(m.number);
      // Заголовок-итог модуля (кликабельный для сворачивания/разворачивания)
      cols.push({ id: 'm' + m.number, label: 'М' + m.number, field: 'moduleScore', moduleNum: m.number, toggle: 'module', expanded: mExp, border: true });
      if (!mExp) continue;
      let li = 0;
      for (const lec of m.lectures) {
        li++;
        const lExp = this.expLectures.has(lec.id);
        cols.push({ id: 'lt' + lec.id, label: 'Л' + li, field: 'lecTotal', moduleNum: m.number, lecId: lec.id, toggle: 'lecture', expanded: lExp, border: true });
        if (lExp) {
          for (const code of lec.taskCodes) {
            cols.push({ id: 'lt' + lec.id + 't' + code, label: code, field: 'task', moduleNum: m.number, lecId: lec.id, taskCode: code });
          }
          cols.push({ id: 'lc' + lec.id, label: 'Кф', field: 'lecCoef', moduleNum: m.number, lecId: lec.id });
          cols.push({ id: 'le' + lec.id, label: 'Т', field: 'lecTest', moduleNum: m.number, lecId: lec.id });
        }
      }
      cols.push({ id: 'hw' + m.number, label: 'ДЗ', field: 'homework', moduleNum: m.number, border: true });
      if (m.hasKt) {
        cols.push({ id: 'kc' + m.number, label: 'Кф', field: 'ktCoef', moduleNum: m.number });
        cols.push({ id: 'kp' + m.number, label: 'КТ', field: 'ktPoints', moduleNum: m.number });
      }
    }
    return cols;
  }

  cell(col: Col, sid: string): string {
    if (!this.data) return '';
    if (col.field === 'name') return this.data.students.find(s => s.id === sid)?.name ?? '';
    const row = this.data.rows[sid];
    if (!row) return '';
    if (col.field === 'mark') return row.finalMark;
    if (col.field === 'weighted') return this.fmt(row.weighted);
    if (col.field === 'raw') return this.fmt(row.raw);
    const mv = col.moduleNum != null ? row.modules[col.moduleNum] : undefined;
    if (!mv) return '';
    if (col.field === 'moduleScore') return this.fmt(mv.score);
    if (col.field === 'homework') return this.fmt(mv.homework);
    if (col.field === 'ktCoef') return mv.ktCoef ? this.fmt(mv.ktCoef) : '';
    if (col.field === 'ktPoints') return this.fmt(mv.ktPoints);
    const lv = col.lecId ? mv.lectures[col.lecId] : undefined;
    if (!lv) return '';
    if (col.field === 'lecTotal') return this.fmt(lv.total);
    if (col.field === 'lecCoef') return lv.coef ? this.fmt(lv.coef) : '';
    if (col.field === 'lecTest') return this.fmt(lv.test);
    if (col.field === 'task' && col.taskCode) return this.fmt(lv.tasks[col.taskCode] ?? 0);
    return '';
  }

  fmt(n: number): string { return n === 0 ? '0' : (Math.round(n * 100) / 100).toString(); }

  thClass(col: Col): string {
    let c = 'px-2 py-2 text-left font-semibold text-[#1A1A1B] border-b border-[#E5E7EB] whitespace-nowrap';
    if (col.border) c += ' border-l-2 border-l-[#9CA3AF]';
    if (col.toggle) c += ' cursor-pointer hover:bg-[#EAF2FF]';
    if (col.toggle && col.expanded) c += ' bg-[#EAF2FF] text-[#005BFF]';
    if (col.field === 'name') c += ' sticky left-0 bg-[#F9FAFB] z-10';
    return c;
  }
  tdClass(col: Col): string {
    let c = 'px-2 py-1.5 border-b border-[#F3F4F6] whitespace-nowrap';
    if (col.border) c += ' border-l-2 border-l-[#E5E7EB]';
    if (col.field === 'name') c += ' sticky left-0 bg-white z-10 font-medium text-[#1A1A1B]';
    else if (col.field === 'mark') c += ' font-semibold';
    else if (col.field === 'weighted' || col.field === 'moduleScore') c += ' text-[#005BFF] font-medium';
    else c += ' text-[#6B7280]';
    return c;
  }
}
