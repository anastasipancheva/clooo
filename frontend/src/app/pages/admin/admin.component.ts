import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import {
  Course, StudentScore, TeacherActivity, CourseStructure,
  AssistantApplicationDto, ActivityTeam,
} from '../../core/models';

type Tab = 'courses' | 'structure' | 'materials' | 'students' | 'scores' | 'schedule' | 'teams';
type StudentsSubTab = 'students' | 'staff';

const INPUT = 'h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition bg-white';
const BTN_PRIMARY = 'h-9 px-4 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] disabled:opacity-60 transition-colors flex items-center gap-1.5';
const BTN_GHOST = 'h-9 px-3 rounded-lg border border-[#E5E7EB] text-xs text-[#1A1A1B] hover:bg-[#F3F4F6] transition-colors flex items-center gap-1.5';

function defaultAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, KeyValuePipe],
  template: `
    <div class="space-y-5">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">Управление</h1>

      <!-- Tab bar -->
      <div class="flex flex-wrap gap-1 bg-[#F3F4F6] rounded-lg p-1 w-fit">
        @for (t of tabs; track t.key) {
          <button (click)="setTab(t.key)"
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            [class]="tab === t.key ? 'bg-white text-[#005BFF] shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A1B]'">
            {{ t.label }}
          </button>
        }
      </div>

      <!-- Course selector (for non-courses tabs) -->
      @if (tab !== 'courses') {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <p class="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-2">Выберите курс</p>
          <div class="flex flex-wrap gap-2">
            @for (c of courseList; track c.id) {
              <button (click)="selected = selected === c.id ? null : c.id; onCourseChange()"
                class="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                [class]="selected === c.id ? 'bg-[#005BFF] text-white border-[#005BFF]' : 'bg-white text-[#1A1A1B] border-[#E5E7EB] hover:border-[#005BFF]/40'">
                {{ c.code }} — {{ c.title }}
              </button>
            }
            @if (courseList.length === 0) {
              <p class="text-sm text-[#9CA3AF]">Нет курсов. Создайте на вкладке Курсы.</p>
            }
          </div>
        </div>
      }

      <!-- ══ TAB: COURSES ══ -->
      @if (tab === 'courses') {
        <div class="space-y-5">
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Создать курс</p>
            <div class="flex flex-wrap gap-3 items-end">
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Код</label>
                <input [class]="INPUT + ' w-24'" [(ngModel)]="newCode" placeholder="MKN2" />
              </div>
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Название</label>
                <input [class]="INPUT + ' w-56'" [(ngModel)]="newTitle" placeholder="Математика для КН ч.2" />
              </div>
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Учебный год</label>
                <input [class]="INPUT + ' w-28'" [(ngModel)]="newYear" />
              </div>
              <button (click)="createCourse()" [class]="BTN_PRIMARY">➕ Создать</button>
            </div>
          </div>

          @if (courseList.length > 0) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Все курсы</p>
              <div class="divide-y divide-[#F3F4F6]">
                @for (c of courseList; track c.id) {
                  <div class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <span class="text-sm font-semibold text-[#1A1A1B]">{{ c.code }}</span>
                      <span class="text-sm text-[#6B7280] ml-2">{{ c.title }}</span>
                      <span class="text-xs text-[#9CA3AF] ml-2">{{ c.academicYear }}</span>
                    </div>
                    <button (click)="deleteCourse(c.id, c.code)"
                      class="w-8 h-8 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-red-50 transition-colors">
                      🗑
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- ══ TAB: STRUCTURE ══ -->
      @if (tab === 'structure' && selected) {
        <div class="space-y-5">
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Добавить модуль</p>
            <div class="flex flex-wrap gap-3 items-end">
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Номер</label>
                <input [class]="INPUT + ' w-16'" type="number" [(ngModel)]="moduleNum" />
              </div>
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Название</label>
                <input [class]="INPUT + ' w-44'" [(ngModel)]="moduleTitle" placeholder="Модуль 1" />
              </div>
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Начало</label>
                <input [class]="INPUT" type="date" [(ngModel)]="moduleStart" />
              </div>
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Конец</label>
                <input [class]="INPUT" type="date" [(ngModel)]="moduleEnd" />
              </div>
              <button (click)="addModule()" [class]="BTN_PRIMARY">➕ Добавить</button>
            </div>
          </div>

          @if (structureLoading) {
            <p class="text-sm text-[#6B7280] animate-pulse">Загрузка структуры...</p>
          }
          @if (!structureLoading) {
            <div class="flex items-center justify-between mb-1">
              <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                Структура: {{ structure?.code }} — {{ structure?.title }}
              </p>
              <button (click)="loadStructure()" [class]="BTN_GHOST">🔄 Обновить</button>
            </div>
          }
          @if (!structureLoading && structure) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div class="p-4 space-y-3">
                @if (structure.modules.length === 0) {
                  <p class="text-sm text-[#9CA3AF] text-center py-4">Нет модулей. Добавьте модуль выше.</p>
                }
                @for (m of structure.modules; track m.id) {
                  <div class="border border-[#E5E7EB] rounded-lg overflow-hidden">
                    <!-- Module header -->
                    <div class="bg-[#F9FAFB] px-4 py-2.5 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-[#005BFF] uppercase">М{{ m.number }}</span>
                        <span class="text-sm font-semibold text-[#1A1A1B]">{{ m.title }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-[#9CA3AF]">
                          {{ m.startsAt | date:'dd.MM.yyyy' }} — {{ m.endsAt | date:'dd.MM.yyyy' }}
                        </span>
                        <button
                          (click)="selectedModuleId = selectedModuleId === m.id ? null : m.id; actTitle=''; actStart=''; actEnd=''; actType='1'"
                          class="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                          [class]="selectedModuleId === m.id ? 'bg-[#005BFF] text-white' : 'bg-[#EAF2FF] text-[#005BFF] hover:bg-[#D1E6FF]'">
                          ➕ Занятие
                        </button>
                        <button (click)="deleteModule(m.id, m.title)"
                          class="flex items-center justify-center w-7 h-7 rounded-md text-[#9CA3AF] hover:text-[#EF4444] hover:bg-red-50 transition-colors">
                          🗑
                        </button>
                      </div>
                    </div>

                    <!-- Inline add-activity form -->
                    @if (selectedModuleId === m.id) {
                      <div class="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFBFF]">
                        <p class="text-xs text-[#9CA3AF] mb-2">
                          Период модуля: {{ m.startsAt | date:'dd.MM.yyyy' }} — {{ m.endsAt | date:'dd.MM.yyyy' }}
                        </p>
                        <div class="flex flex-wrap gap-2 items-end">
                          <div>
                            <label class="block text-xs text-[#6B7280] mb-1">Тип</label>
                            <select [class]="INPUT + ' pr-8'" [(ngModel)]="actType">
                              <option value="1">Лекция</option>
                              <option value="2">КТ</option>
                              <option value="3">ДЗ-сессия</option>
                            </select>
                          </div>
                          <div>
                            <label class="block text-xs text-[#6B7280] mb-1">Название</label>
                            <input [class]="INPUT + ' w-40'" [(ngModel)]="actTitle" placeholder="Лекция 1" />
                          </div>
                          <div>
                            <label class="block text-xs text-[#6B7280] mb-1">Начало</label>
                            <input [class]="INPUT" type="datetime-local" [(ngModel)]="actStart" />
                          </div>
                          <div>
                            <label class="block text-xs text-[#6B7280] mb-1">Конец</label>
                            <input [class]="INPUT" type="datetime-local" [(ngModel)]="actEnd" />
                          </div>
                          <button (click)="addActivity(m.id)" [class]="BTN_PRIMARY">➕ Добавить</button>
                          <button (click)="selectedModuleId = null" [class]="BTN_GHOST">Отмена</button>
                        </div>
                      </div>
                    }

                    <!-- Activities list -->
                    @if (m.activities.length === 0 && selectedModuleId !== m.id) {
                      <p class="px-4 py-3 text-xs text-[#9CA3AF]">Нет занятий — нажмите «+ Занятие» выше</p>
                    }
                    @if (m.activities.length > 0) {
                      <div class="divide-y divide-[#F3F4F6]">
                        @for (a of m.activities; track a.id) {
                          <div class="px-4 py-2.5">
                            <div class="flex items-center gap-2 flex-wrap">
                              <span class="text-xs font-medium px-1.5 py-0.5 rounded"
                                [class]="a.type === 'ControlPoint' ? 'bg-[#FEF3C7] text-[#D97706]' : a.type === 'Lecture' ? 'bg-[#EAF2FF] text-[#005BFF]' : 'bg-[#F3F4F6] text-[#6B7280]'">
                                {{ actTypeLabel(a.type) }}
                              </span>
                              <span class="text-sm font-medium text-[#1A1A1B]">{{ a.title }}</span>
                              <span class="text-xs text-[#9CA3AF]">
                                {{ a.startsAt | date:'d MMM HH:mm' }}
                              </span>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
      @if (tab === 'structure' && !selected) {
        <p class="text-sm text-[#9CA3AF]">Выберите курс выше.</p>
      }

      <!-- ══ TAB: MATERIALS ══ -->
      @if (tab === 'materials' && selected) {
        <div class="space-y-5">
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Выберите занятие</p>
            @if (scheduleLoading) { <p class="text-sm text-[#9CA3AF]">Загрузка...</p> }
            @if (!scheduleLoading && scheduleActivities.length === 0) {
              <p class="text-sm text-[#9CA3AF]">Нет занятий. Добавьте их на вкладке Структура.</p>
            }
            <div class="space-y-1.5">
              @for (a of nonHwActivities; track a.id) {
                <button (click)="selectMatActivity(a)"
                  class="w-full text-left px-3 py-2.5 rounded-lg border transition-colors"
                  [class]="matActivity?.id === a.id && matHwModuleIds.length === 0 ? 'border-[#005BFF] bg-[#EAF2FF]' : 'border-[#E5E7EB] hover:border-[#005BFF]/30'">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="text-xs text-[#6B7280] mr-2">М{{ a.moduleNumber }} / {{ a.typeLabel }}</span>
                      <span class="text-sm font-medium text-[#1A1A1B]">{{ a.title }}</span>
                    </div>
                    @if (a.preLectureVideoUrl || a.theoryTestUrl || a.taskFileUrl) {
                      <span class="text-xs text-[#059669] bg-[#D1FAE5] px-2 py-0.5 rounded-full">материалы</span>
                    }
                  </div>
                  <p class="text-xs text-[#9CA3AF] mt-0.5">{{ a.startsAt | date:'EEE d MMM HH:mm' }}</p>
                </button>
              }
              @for (entry of hwByModule | keyvalue; track entry.key) {
                <button (click)="selectHwModule(entry.value)"
                  class="w-full text-left px-3 py-2.5 rounded-lg border transition-colors"
                  [class]="matHwModuleIds.length > 0 && matHwModuleIds.includes(entry.value[0].id) ? 'border-[#005BFF] bg-[#EAF2FF]' : 'border-[#E5E7EB] hover:border-[#005BFF]/30'">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="text-xs text-[#6B7280] mr-2">М{{ entry.value[0].moduleNumber }} / ДЗ-сессии ({{ entry.value.length }} зан.)</span>
                      <span class="text-sm font-medium text-[#1A1A1B]">Домашние задания модуля</span>
                    </div>
                    @if (hwGroupHasFile(entry.value)) {
                      <span class="text-xs text-[#059669] bg-[#D1FAE5] px-2 py-0.5 rounded-full">файл</span>
                    }
                  </div>
                  <p class="text-xs text-[#9CA3AF] mt-0.5">Один файл на все {{ entry.value.length }} занятий модуля</p>
                </button>
              }
            </div>
          </div>

          @if (matActivity) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <div class="mb-4">
                <p class="text-sm font-semibold text-[#1A1A1B]">
                  {{ matHwModuleIds.length > 0 ? 'Домашние задания — М' + matActivity.moduleNumber : matActivity.title }}
                </p>
                <p class="text-xs text-[#6B7280]">
                  {{ matHwModuleIds.length > 0
                    ? matHwModuleIds.length + ' занятий ДЗ-сессии · один файл на весь модуль'
                    : 'М' + matActivity.moduleNumber + ' / ' + matActivity.typeLabel }}
                </p>
              </div>
              <div class="space-y-4">
                @if (matActivity.typeLabel === 'Лекция' && matHwModuleIds.length === 0) {
                  <div>
                    <label class="block text-xs text-[#6B7280] mb-1">📹 Видео для просмотра до лекции</label>
                    <input type="url" [class]="INPUT + ' w-full'" placeholder="https://youtube.com/..."
                      [(ngModel)]="matVideoUrl" />
                  </div>
                  <div>
                    <label class="block text-xs text-[#6B7280] mb-1">📝 Тест на теорию (Google Forms)</label>
                    <input type="url" [class]="INPUT + ' w-full'" placeholder="https://forms.google.com/..."
                      [(ngModel)]="matTestUrl" />
                  </div>
                }
                <div>
                  <label class="block text-xs text-[#6B7280] mb-1">
                    📎 {{ matHwModuleIds.length > 0 ? 'Файл с домашними заданиями' : matActivity.typeLabel === 'Лекция' ? 'Файл с заданиями для лекции' : 'Файл с заданиями КТ' }}
                  </label>
                  <input type="url" [class]="INPUT + ' w-full'" placeholder="https://drive.google.com/..."
                    [(ngModel)]="matFileUrl" />
                </div>
                <button (click)="saveMaterials()" [disabled]="matSaving" [class]="BTN_PRIMARY">
                  {{ matSaving ? 'Сохранение...' : 'Сохранить материалы' }}
                </button>
              </div>
            </div>
          }
        </div>
      }
      @if (tab === 'materials' && !selected) {
        <p class="text-sm text-[#9CA3AF]">Выберите курс выше.</p>
      }

      <!-- ══ TAB: STUDENTS ══ -->
      @if (tab === 'students') {
        <div class="space-y-5">
          <!-- Sub-tab switcher -->
          <div class="flex gap-1 bg-[#F3F4F6] rounded-lg p-1 w-fit">
            <button (click)="studentsSubTab = 'students'"
              class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
              [class]="studentsSubTab === 'students' ? 'bg-white text-[#005BFF] shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A1B]'">
              Студенты
            </button>
            <button (click)="studentsSubTab = 'staff'"
              class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
              [class]="studentsSubTab === 'staff' ? 'bg-white text-[#005BFF] shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A1B]'">
              Персонал
            </button>
          </div>

          @if (studentsSubTab === 'students') {
            @if (selected) {
              <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Массовая запись студентов на курс</p>
                <textarea rows="5"
                  class="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition resize-none"
                  placeholder="student1&#64;edu.ru&#10;student2&#64;edu.ru&#10;(каждый email на новой строке)"
                  [(ngModel)]="bulkEmails"></textarea>
                <div class="flex items-center gap-2 mt-2">
                  <button (click)="enrollBulk()" [class]="BTN_PRIMARY">Записать студентов</button>
                  <p class="text-xs text-[#9CA3AF]">Email должен совпадать с зарегистрированным в системе</p>
                </div>
              </div>

              <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div class="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                  <p class="text-sm font-semibold text-[#1A1A1B]">Записаны на курс ({{ courseStudents.length }})</p>
                  <button (click)="loadStudents()" [class]="BTN_GHOST">🔄 Обновить</button>
                </div>
                @if (courseStudents.length === 0) {
                  <p class="px-5 py-4 text-sm text-[#9CA3AF]">Нет студентов на этом курсе</p>
                } @else {
                  <div class="divide-y divide-[#F3F4F6]">
                    @for (u of courseStudents; track u.id) {
                      <div class="flex items-center justify-between px-5 py-3">
                        <div>
                          <p class="text-sm font-medium text-[#1A1A1B]">{{ u.displayName }}</p>
                          <p class="text-xs text-[#6B7280]">{{ u.email }}</p>
                        </div>
                        <span class="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded">{{ u.role }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div class="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                <p class="text-sm font-semibold text-[#1A1A1B]">Все студенты ({{ allStudents.length }})</p>
                <button (click)="loadAllUsers()" [class]="BTN_GHOST">🔄 Обновить</button>
              </div>
              @if (allStudents.length === 0) {
                <p class="px-5 py-4 text-sm text-[#9CA3AF]">Нет студентов</p>
              } @else {
                <div class="divide-y divide-[#F3F4F6]">
                  @for (u of allStudents; track u.id) {
                    <div class="flex items-center justify-between px-5 py-3">
                      <div>
                        <p class="text-sm font-medium text-[#1A1A1B]">{{ u.displayName }}</p>
                        <p class="text-xs text-[#6B7280]">{{ u.email }}</p>
                      </div>
                      <span class="text-xs bg-[#F3F4F6] text-[#6B7280] px-2 py-0.5 rounded">Студент</span>
                    </div>
                  }
                </div>
              }
            </div>
          }

          @if (studentsSubTab === 'staff') {
            <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div class="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                <p class="text-sm font-semibold text-[#1A1A1B]">Преподаватели и ассистенты ({{ allStaff.length }})</p>
                <button (click)="loadAllUsers()" [class]="BTN_GHOST">🔄 Обновить</button>
              </div>
              @if (allStaff.length === 0) {
                <p class="px-5 py-4 text-sm text-[#9CA3AF]">Нет преподавателей или ассистентов</p>
              } @else {
                <div class="divide-y divide-[#F3F4F6]">
                  @for (u of allStaff; track u.id) {
                    <div class="flex items-center justify-between px-5 py-3">
                      <div>
                        <p class="text-sm font-medium text-[#1A1A1B]">{{ u.displayName }}</p>
                        <p class="text-xs text-[#6B7280]">{{ u.email }}</p>
                      </div>
                      <div class="flex items-center gap-3">
                        <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                          [class]="u.role === 'Teacher' || u.role === 'Admin' ? 'bg-[#EAF2FF] text-[#005BFF]' : 'bg-[#FEF3C7] text-[#D97706]'">
                          {{ u.role === 'Teacher' || u.role === 'Admin' ? 'Преподаватель' : 'Ассистент' }}
                        </span>
                        <select [class]="INPUT + ' w-36 text-xs'"
                          (change)="onRoleChange(u.id, $any($event.target).value)">
                          <option value="">Изменить роль...</option>
                          <option value="Student">Студент</option>
                          <option value="Assistant">Ассистент</option>
                          <option value="Teacher">Преподаватель</option>
                        </select>
                      </div>
                    </div>
                  }
                </div>
              }
              <!-- Assign role to any student -->
              <div class="px-5 py-3 border-t border-[#E5E7EB]">
                <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Назначить роль любому пользователю</p>
                <div class="space-y-2 max-h-64 overflow-y-auto">
                  @for (u of allStudents; track u.id) {
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="text-sm text-[#1A1A1B]">{{ u.displayName }}</span>
                        <span class="text-xs text-[#9CA3AF] ml-2">{{ u.email }}</span>
                      </div>
                      <select [class]="INPUT + ' w-36 text-xs'"
                        (change)="onRoleChange(u.id, $any($event.target).value)">
                        <option value="">Изменить роль...</option>
                        <option value="Student">Студент</option>
                        <option value="Assistant">Ассистент</option>
                        <option value="Teacher">Преподаватель</option>
                      </select>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- ══ TAB: SCORES ══ -->
      @if (tab === 'scores' && selected && allScores.length > 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#E5E7EB]">
            <p class="text-sm font-semibold text-[#1A1A1B]">Таблица баллов</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th class="text-left px-5 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Студент</th>
                  <th class="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">М1</th>
                  <th class="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">М2</th>
                  <th class="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">М3</th>
                  <th class="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Итог</th>
                  <th class="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Оценка</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#F3F4F6]">
                @for (s of allScores; track s.studentId) {
                  <tr class="hover:bg-[#F9FAFB] transition-colors">
                    <td class="px-5 py-3 font-medium text-[#1A1A1B]">{{ s.displayName }}</td>
                    <td class="text-right px-4 py-3 text-[#6B7280]">{{ modScore(s, 1).toFixed(1) }}</td>
                    <td class="text-right px-4 py-3 text-[#6B7280]">{{ modScore(s, 2).toFixed(1) }}</td>
                    <td class="text-right px-4 py-3 text-[#6B7280]">{{ modScore(s, 3).toFixed(1) }}</td>
                    <td class="text-right px-4 py-3 font-semibold text-[#1A1A1B]">{{ s.finalScore.toFixed(1) }}</td>
                    <td class="text-right px-5 py-3">
                      <span class="text-xs font-bold px-2 py-0.5 rounded-full" [class]="markColor(s.mark)">{{ s.mark }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
      @if (tab === 'scores' && selected && allScores.length === 0) {
        <p class="text-sm text-[#9CA3AF]">Нет данных о баллах для выбранного курса.</p>
      }
      @if (tab === 'scores' && !selected) {
        <p class="text-sm text-[#9CA3AF]">Выберите курс выше.</p>
      }

      <!-- ══ TAB: SCHEDULE ══ -->
      @if (tab === 'schedule' && selected) {
        <div class="space-y-3">
          @if (scheduleLoading) { <p class="text-sm text-[#6B7280] animate-pulse">Загрузка...</p> }
          @if (!scheduleLoading && scheduleActivities.length === 0) {
            <p class="text-sm text-[#9CA3AF]">Нет занятий. Добавьте их на вкладке Структура.</p>
          }
          @for (a of scheduleActivities; track a.id) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] p-4">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs text-[#6B7280] font-medium">М{{ a.moduleNumber }}</span>
                    <span class="text-xs text-[#9CA3AF]">{{ a.typeLabel }}</span>
                    <span class="text-sm font-semibold text-[#1A1A1B] truncate">{{ a.title }}</span>
                  </div>
                  <p class="text-xs text-[#6B7280] mt-0.5">
                    {{ a.startsAt | date:'EEE d MMM HH:mm' }} — {{ a.endsAt | date:'HH:mm' }}
                  </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-xs font-medium px-2.5 py-1 rounded-full" [class]="statusBadge(a.status)">
                    {{ statusLabel(a.status) }}
                  </span>
                  @if (a.status === 'Scheduled') {
                    <button (click)="startActivity(a.id)"
                      class="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] transition-colors">
                      ▶ Начать
                    </button>
                  }
                  @if (a.status === 'Active') {
                    <button (click)="finishActivity(a.id)"
                      class="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#EF4444] text-white text-xs font-medium hover:bg-[#DC2626] transition-colors">
                      ■ Завершить
                    </button>
                  }
                  <button (click)="appsActivityId === a.id ? appsActivityId = null : loadApplications(a.id)"
                    [class]="BTN_GHOST">
                    👥 Заявки
                  </button>
                </div>
              </div>

              @if (appsActivityId === a.id) {
                <div class="mt-3 pt-3 border-t border-[#F3F4F6] space-y-2">
                  @if (applications.length === 0) { <p class="text-xs text-[#9CA3AF]">Заявок нет</p> }
                  @for (app of applications; track app.id) {
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-xs font-medium text-[#1A1A1B]">{{ app.assistantName }}</p>
                        <p class="text-xs text-[#6B7280]">{{ app.assistantEmail }}</p>
                        @if (app.message) { <p class="text-xs text-[#9CA3AF] italic">{{ app.message }}</p> }
                      </div>
                      <div class="flex items-center gap-2">
                        @if (app.status === 'Pending') {
                          <button (click)="reviewApplication(app.id, true)"
                            class="h-7 px-3 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] transition-colors">
                            Принять
                          </button>
                          <button (click)="reviewApplication(app.id, false)"
                            class="h-7 px-3 rounded-lg bg-[#EF4444] text-white text-xs font-medium hover:bg-[#DC2626] transition-colors">
                            Отклонить
                          </button>
                        } @else {
                          <span class="text-xs font-medium px-2.5 py-1 rounded-full"
                            [class]="app.status === 'Approved' ? 'bg-[#D1FAE5] text-[#059669]' : 'bg-[#FEE2E2] text-[#DC2626]'">
                            {{ app.status === 'Approved' ? 'Принят' : 'Отклонён' }}
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
      @if (tab === 'schedule' && !selected) {
        <p class="text-sm text-[#9CA3AF]">Выберите курс выше.</p>
      }

      <!-- ══ TAB: TEAMS ══ -->
      @if (tab === 'teams' && selected) {
        <div class="space-y-5">
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Генерация команд (только для лекций)</p>
            <div class="flex flex-wrap gap-3 items-end">
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Занятие</label>
                <select [class]="INPUT + ' pr-8 min-w-60'"
                  [(ngModel)]="teamsActivityId"
                  (ngModelChange)="onTeamsActivityChange($event)">
                  <option value="">— выберите лекцию —</option>
                  @for (a of lectureActivities; track a.id) {
                    <option [value]="a.id">М{{ a.moduleNumber }} / {{ a.title }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Размер команды</label>
                <input [class]="INPUT + ' w-20'" type="number" min="2" max="10" [(ngModel)]="teamSize" />
              </div>
              <button (click)="generateTeams()" [disabled]="generating || !teamsActivityId" [class]="BTN_PRIMARY">
                {{ generating ? '⏳ Генерация...' : '👥 Сгенерировать' }}
              </button>
            </div>
            <p class="text-xs text-[#9CA3AF] mt-2">
              Алгоритм: змейка по списку записанных студентов. Текущие команды заменяются.
            </p>
            @if (lectureActivities.length === 0 && !scheduleLoading) {
              <p class="text-xs text-[#EF4444] mt-2">Нет лекций в расписании. Добавьте занятия типа «Лекция».</p>
            }
          </div>

          @if (teamsLoading) { <p class="text-sm text-[#6B7280] animate-pulse">Загрузка команд...</p> }

          @if (!teamsLoading && teams.length > 0) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              @for (t of teams; track t.id) {
                <div class="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p class="text-sm font-semibold text-[#1A1A1B] mb-2">{{ t.name }}</p>
                  <div class="space-y-1">
                    @for (m of t.members; track m.userId) {
                      <div class="flex items-center gap-2">
                        <div class="w-5 h-5 rounded-full bg-[#EAF2FF] flex items-center justify-center flex-shrink-0">
                          <span class="text-[9px] font-bold text-[#005BFF]">{{ m.displayName?.[0]?.toUpperCase() }}</span>
                        </div>
                        <span class="text-xs text-[#1A1A1B]">{{ m.displayName }}</span>
                      </div>
                    }
                    @if (t.members.length === 0) { <p class="text-xs text-[#9CA3AF]">нет участников</p> }
                  </div>
                  @if (t.assistants.length > 0) {
                    <div class="mt-2 pt-2 border-t border-[#F3F4F6]">
                      @for (a of t.assistants; track a.assistantId) {
                        <span class="text-xs text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-full">{{ a.displayName }}</span>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }

          @if (!teamsLoading && teamsActivityId && teams.length === 0 && !generating) {
            <p class="text-sm text-[#9CA3AF]">Нет команд. Нажмите «Сгенерировать».</p>
          }
        </div>
      }
      @if (tab === 'teams' && !selected) {
        <p class="text-sm text-[#9CA3AF]">Выберите курс выше.</p>
      }
    </div>
  `
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  readonly INPUT = INPUT;
  readonly BTN_PRIMARY = BTN_PRIMARY;
  readonly BTN_GHOST = BTN_GHOST;

  tab: Tab = 'courses';
  courseList: Course[] = [];
  selected: string | null = null;

  // Courses tab
  newCode = ''; newTitle = ''; newYear = defaultAcademicYear();

  // Structure tab
  structure: CourseStructure | null = null;
  structureLoading = false;
  moduleTitle = ''; moduleNum = '1'; moduleStart = ''; moduleEnd = '';
  selectedModuleId: string | null = null;
  actTitle = ''; actType = '1'; actStart = ''; actEnd = '';

  // Materials tab
  matActivity: TeacherActivity | null = null;
  matVideoUrl = ''; matTestUrl = ''; matFileUrl = '';
  matSaving = false;
  matHwModuleIds: string[] = [];
  nonHwActivities: TeacherActivity[] = [];
  hwByModule: Map<string, TeacherActivity[]> = new Map();

  // Students tab
  studentsSubTab: StudentsSubTab = 'students';
  courseStudents: { id: string; email: string; displayName: string; role: string }[] = [];
  allUsers: { id: string; email: string; displayName: string; role: string }[] = [];
  bulkEmails = '';

  // Scores tab
  allScores: StudentScore[] = [];

  // Schedule tab
  scheduleActivities: TeacherActivity[] = [];
  scheduleLoading = false;
  appsActivityId: string | null = null;
  applications: AssistantApplicationDto[] = [];

  // Teams tab
  teamsActivityId = '';
  teamSize = '5';
  teams: ActivityTeam[] = [];
  teamsLoading = false;
  generating = false;

  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'courses', label: 'Курсы' },
    { key: 'structure', label: 'Структура' },
    { key: 'materials', label: 'Задания' },
    { key: 'students', label: 'Студенты/Персонал' },
    { key: 'scores', label: 'Баллы' },
    { key: 'schedule', label: 'Расписание' },
    { key: 'teams', label: 'Команды' },
  ];

  get allStudents() { return this.allUsers.filter(u => u.role === 'Student'); }
  get allStaff() { return this.allUsers.filter(u => ['Teacher', 'Assistant', 'Admin'].includes(u.role)); }
  get lectureActivities() { return this.scheduleActivities.filter(a => a.typeLabel === 'Лекция'); }

  ngOnInit() { this.loadCourses(); }

  async loadCourses() {
    this.courseList = await this.api.listCourses().catch(() => [] as Course[]);
  }

  onCourseChange() {
    if (!this.selected) return;
    if (this.tab === 'scores') this.api.courseScores(this.selected).then(s => this.allScores = s).catch(() => this.allScores = []);
    if (this.tab === 'structure') this.loadStructure();
    if (this.tab === 'students') this.loadStudents();
    if (this.tab === 'schedule' || this.tab === 'materials' || this.tab === 'teams') this.loadSchedule();
  }

  async loadStructure() {
    if (!this.selected) return;
    this.structureLoading = true;
    try { this.structure = await this.api.courseStructure(this.selected); }
    catch { this.structure = null; this.toast.error('Не удалось загрузить структуру курса'); }
    finally { this.structureLoading = false; }
  }

  async loadAllUsers() {
    try { this.allUsers = await this.api.listAllUsers(); } catch {}
  }

  async loadStudents() {
    if (!this.selected) return;
    try { this.courseStudents = await this.api.courseStudents(this.selected); } catch {}
  }

  async loadSchedule() {
    if (!this.selected) return;
    this.scheduleLoading = true;
    try {
      this.scheduleActivities = await this.api.getCourseActivities(this.selected);
      this.buildHwMap();
    } catch { this.scheduleActivities = []; }
    finally { this.scheduleLoading = false; }
  }

  buildHwMap() {
    this.hwByModule = new Map();
    this.nonHwActivities = [];
    for (const a of this.scheduleActivities) {
      if (a.typeLabel === 'ДЗ-сессия') {
        const arr = this.hwByModule.get(a.moduleId) ?? [];
        arr.push(a);
        this.hwByModule.set(a.moduleId, arr);
      } else {
        this.nonHwActivities.push(a);
      }
    }
  }

  async createCourse() {
    if (!this.newCode || !this.newTitle) { this.toast.error('Заполните код и название'); return; }
    try {
      await this.api.createCourse(this.newCode, this.newTitle, this.newYear);
      this.toast.success('Курс создан');
      this.newCode = ''; this.newTitle = '';
      await this.loadCourses();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async deleteCourse(courseId: string, code: string) {
    if (!confirm(`Удалить курс ${code}? Это действие нельзя отменить.`)) return;
    try {
      await this.api.deleteCourse(courseId);
      this.toast.success('Курс удалён');
      if (this.selected === courseId) this.selected = null;
      await this.loadCourses();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async addModule() {
    if (!this.selected || !this.moduleTitle || !this.moduleStart || !this.moduleEnd) {
      this.toast.error('Заполните все поля модуля'); return;
    }
    const start = new Date(this.moduleStart);
    const end = new Date(this.moduleEnd);
    if (end <= start) { this.toast.error('Дата окончания должна быть позже даты начала'); return; }
    const course = this.courseList.find(c => c.id === this.selected);
    if (course?.academicYear) {
      const [yStart, yEnd] = course.academicYear.split('/').map(Number);
      if (!isNaN(yStart) && !isNaN(yEnd)) {
        const yearStart = new Date(yStart, 8, 1);
        const yearEnd = new Date(yEnd, 7, 31, 23, 59, 59);
        if (start < yearStart || end > yearEnd) {
          this.toast.error(`Даты модуля должны быть в пределах учебного года ${course.academicYear}`);
          return;
        }
      }
    }
    try {
      await this.api.addModule(this.selected, parseInt(this.moduleNum), this.moduleTitle, start.toISOString(), end.toISOString());
      this.toast.success('Модуль добавлен');
      this.moduleTitle = ''; this.moduleStart = ''; this.moduleEnd = '';
      await this.loadStructure();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async deleteModule(moduleId: string, title: string) {
    if (!confirm(`Удалить модуль «${title}»? Будут удалены все занятия, задачи и команды этого модуля.`)) return;
    try {
      await this.api.deleteModule(moduleId);
      this.toast.success('Модуль удалён');
      await this.loadStructure();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async addActivity(moduleId: string) {
    if (!this.actTitle || !this.actStart || !this.actEnd) {
      this.toast.error('Заполните название и даты занятия'); return;
    }
    const start = new Date(this.actStart);
    const end = new Date(this.actEnd);
    if (end <= start) { this.toast.error('Дата окончания должна быть позже даты начала'); return; }
    const mod = this.structure?.modules.find(m => m.id === moduleId);
    if (mod) {
      const startDate = this.actStart.slice(0, 10);
      const endDate = this.actEnd.slice(0, 10);
      if (startDate < mod.startsAt.slice(0, 10) || endDate > mod.endsAt.slice(0, 10)) {
        this.toast.error(`Занятие должно быть в пределах дат модуля: ${new Date(mod.startsAt).toLocaleDateString('ru')} — ${new Date(mod.endsAt).toLocaleDateString('ru')}`);
        return;
      }
    }
    try {
      await this.api.addActivity(moduleId, parseInt(this.actType), this.actTitle, start.toISOString(), end.toISOString());
      this.toast.success('Занятие добавлено');
      this.actTitle = ''; this.actStart = ''; this.actEnd = '';
      this.selectedModuleId = null;
      await this.loadStructure();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  selectMatActivity(act: TeacherActivity) {
    this.matActivity = act;
    this.matVideoUrl = act.preLectureVideoUrl ?? '';
    this.matTestUrl = act.theoryTestUrl ?? '';
    this.matFileUrl = act.taskFileUrl ?? '';
    this.matHwModuleIds = [];
  }

  selectHwModule(activities: TeacherActivity[]) {
    this.matActivity = activities[0];
    this.matVideoUrl = '';
    this.matTestUrl = '';
    this.matFileUrl = activities[0].taskFileUrl ?? '';
    this.matHwModuleIds = activities.map(a => a.id);
  }

  async saveMaterials() {
    if (!this.matActivity) return;
    this.matSaving = true;
    try {
      if (this.matHwModuleIds.length > 0) {
        await Promise.all(this.matHwModuleIds.map(id => this.api.patchMaterials(id, { taskFileUrl: this.matFileUrl })));
      } else {
        await this.api.patchMaterials(this.matActivity.id, {
          preLectureVideoUrl: this.matVideoUrl,
          theoryTestUrl: this.matTestUrl,
          taskFileUrl: this.matFileUrl,
        });
      }
      this.toast.success('Материалы сохранены');
      await this.loadSchedule();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
    finally { this.matSaving = false; }
  }

  async enrollBulk() {
    if (!this.selected || !this.bulkEmails.trim()) { this.toast.error('Выберите курс и введите email-адреса'); return; }
    const emails = this.bulkEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    try {
      const r = await this.api.enrollBulk(this.selected, emails);
      this.toast.success(`Добавлено: ${r.added}. Не найдено: ${r.notFound}`);
      this.bulkEmails = '';
      await this.loadStudents();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async onRoleChange(userId: string, roleName: string) {
    if (!roleName) return;
    try {
      await this.api.setUserRole(userId, roleName);
      this.toast.success('Роль обновлена');
      await this.loadAllUsers();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async startActivity(id: string) {
    try {
      const r = await this.api.startActivity(id);
      this.toast.success('Занятие начато');
      if (r?.theoryTestUrl) this.toast.info(`Мини-тест отправлен студентам: ${r.theoryTestUrl}`);
      await this.loadSchedule();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async finishActivity(id: string) {
    try { await this.api.finishActivity(id); this.toast.success('Занятие завершено'); await this.loadSchedule(); }
    catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async loadApplications(activityId: string) {
    try {
      this.applications = await this.api.listApplications(activityId);
      this.appsActivityId = activityId;
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async reviewApplication(appId: string, approved: boolean) {
    if (!this.appsActivityId) return;
    try {
      await this.api.reviewApplication(this.appsActivityId, appId, approved);
      this.toast.success(approved ? 'Заявка одобрена' : 'Заявка отклонена');
      await this.loadApplications(this.appsActivityId);
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async generateTeams() {
    if (!this.teamsActivityId) { this.toast.error('Выберите занятие'); return; }
    const sz = parseInt(this.teamSize);
    if (isNaN(sz) || sz < 2 || sz > 10) { this.toast.error('Размер команды: от 2 до 10'); return; }
    this.generating = true;
    try {
      const r = await this.api.autoGenerate(this.teamsActivityId, sz);
      this.toast.success(`Создано ${r.teamCount} команд (${r.studentCount} студентов)`);
      this.teams = r.teams;
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
    finally { this.generating = false; }
  }

  async onTeamsActivityChange(actId: string) {
    if (!actId) { this.teams = []; return; }
    this.teamsLoading = true;
    try { this.teams = await this.api.getTeams(actId); }
    catch { this.teams = []; }
    finally { this.teamsLoading = false; }
  }

  // Tab change — load data
  setTab(t: Tab) {
    this.tab = t;
    if (t === 'students') this.loadAllUsers();
    this.onCourseChange();
  }

  modScore(s: StudentScore, n: number) { return s.modules.find(m => m.moduleNumber === n)?.moduleScore ?? 0; }
  markColor(mark: string) {
    if (mark.startsWith('5')) return 'text-[#059669] bg-[#D1FAE5]';
    if (mark.startsWith('4')) return 'text-[#005BFF] bg-[#EAF2FF]';
    if (mark.startsWith('3')) return 'text-[#D97706] bg-[#FEF3C7]';
    return 'text-[#DC2626] bg-[#FEE2E2]';
  }
  actTypeLabel(type: string) {
    return type === 'Lecture' ? 'Лекция' : type === 'ControlPoint' ? 'КТ' : 'ДЗ-сессия';
  }
  statusBadge(s: string) {
    const map: Record<string, string> = { Active: 'bg-[#D1FAE5] text-[#059669]', Finished: 'bg-[#F3F4F6] text-[#9CA3AF]', Scheduled: 'bg-[#FEF3C7] text-[#D97706]' };
    return map[s] ?? 'bg-[#F3F4F6] text-[#9CA3AF]';
  }
  hwGroupHasFile(acts: TeacherActivity[]) { return acts.some(a => a.taskFileUrl); }

  statusLabel(s: string) {
    const map: Record<string, string> = { Active: 'Идёт', Finished: 'Завершено', Scheduled: 'Запланировано' };
    return map[s] ?? s;
  }
}
