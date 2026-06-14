import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import {
  Course, StudentScore, TeacherActivity, CourseStructure,
  AssistantApplicationDto, ActivityTeam, TemplateSummary, TemplateView, TemplateModuleView,
} from '../../core/models';

type Tab = 'courses' | 'structure' | 'materials' | 'students' | 'scores' | 'schedule' | 'teams' | 'templates';
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

      <!-- Course selector (for non-courses and non-templates tabs) -->
      @if (tab !== 'courses' && tab !== 'templates') {
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
                    <div class="flex items-center gap-1.5">
                      <button (click)="showInvite(c.id)"
                        class="h-7 px-3 rounded-lg bg-[#EAF2FF] text-[#005BFF] text-xs font-medium hover:bg-[#D1E6FF] transition-colors">
                        🔗 Ссылка
                      </button>
                      <button (click)="openDeleteCourse(c.id, c.code)"
                        class="w-8 h-8 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-red-50 transition-colors">
                        🗑
                      </button>
                    </div>
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
              <!-- Save as template button -->
              <div class="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAFAFA]">
                <p class="text-xs text-[#6B7280]">{{ structure.modules.length }} модул. · {{ totalActivities(structure) }} занятий</p>
                <button (click)="openSaveAsTemplate()" [class]="BTN_GHOST + ' text-[#7C3AED] border-[#DDD6FE] hover:bg-[#F5F3FF]'">
                  💾 Сохранить как шаблон
                </button>
              </div>
              <div class="p-4 space-y-3">
                @if (structure.modules.length === 0) {
                  <p class="text-sm text-[#9CA3AF] text-center py-4">Нет модулей. Добавьте модуль выше.</p>
                }
                @for (m of structure.modules; track m.id) {
                  <div class="border border-[#E5E7EB] rounded-lg overflow-hidden">
                    <!-- Module header -->
                    <div class="bg-[#F9FAFB] px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-[#005BFF] uppercase">М{{ m.number }}</span>
                        @if (editingModuleId !== m.id) {
                          <span class="text-sm font-semibold text-[#1A1A1B]">{{ m.title }}</span>
                        } @else {
                          <input [class]="INPUT + ' w-40 h-7 text-xs'" [(ngModel)]="editModuleTitle" />
                        }
                      </div>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        @if (editingModuleId !== m.id) {
                          <button (click)="startEditModule(m)"
                            class="flex items-center gap-1 h-7 px-2 rounded-md text-xs text-[#6B7280] hover:text-[#005BFF] hover:bg-[#EAF2FF] transition-colors">
                            ✏️ Даты
                          </button>
                        } @else {
                          <!-- Inline date editor for module -->
                          <input [class]="INPUT + ' w-30 h-7 text-xs'" type="date" [(ngModel)]="editModuleStart" title="Начало" />
                          <span class="text-xs text-[#9CA3AF]">—</span>
                          <input [class]="INPUT + ' w-30 h-7 text-xs'" type="date" [(ngModel)]="editModuleEnd" title="Конец" />
                          <button (click)="saveEditModule(m.id)" [class]="BTN_PRIMARY + ' h-7 text-xs px-3'">✓</button>
                          <button (click)="editingModuleId = null" [class]="BTN_GHOST + ' h-7 text-xs px-2'">✕</button>
                        }
                        @if (editingModuleId !== m.id) {
                          <span class="text-xs text-[#9CA3AF]">
                            {{ m.startsAt | date:'dd.MM' }} — {{ m.endsAt | date:'dd.MM.yyyy' }}
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
                        }
                      </div>
                    </div>

                    <!-- Inline add-activity form -->
                    @if (selectedModuleId === m.id) {
                      <div class="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFBFF]">
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
                          <div class="px-4 py-2">
                            @if (editingActivityId !== a.id) {
                              <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2 flex-wrap min-w-0">
                                  <span class="text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                                    [class]="a.type === 'ControlPoint' ? 'bg-[#FEF3C7] text-[#D97706]' : a.type === 'Lecture' ? 'bg-[#EAF2FF] text-[#005BFF]' : 'bg-[#F3F4F6] text-[#6B7280]'">
                                    {{ actTypeLabel(a.type) }}
                                  </span>
                                  <span class="text-sm font-medium text-[#1A1A1B] truncate">{{ a.title }}</span>
                                  <span class="text-xs text-[#9CA3AF] flex-shrink-0">
                                    {{ a.startsAt | date:'d MMM HH:mm' }} — {{ a.endsAt | date:'HH:mm' }}
                                  </span>
                                </div>
                                <button (click)="startEditActivity(a)"
                                  class="flex-shrink-0 h-6 px-2 rounded-md text-xs text-[#9CA3AF] hover:text-[#005BFF] hover:bg-[#EAF2FF] transition-colors">
                                  ✏️
                                </button>
                              </div>
                            } @else {
                              <!-- Inline editor for activity dates -->
                              <div class="flex flex-wrap gap-2 items-end py-1">
                                <input [class]="INPUT + ' flex-1 min-w-32 h-8 text-xs'" [(ngModel)]="editActTitle" placeholder="Название" />
                                <input [class]="INPUT + ' w-36 h-8 text-xs'" type="datetime-local" [(ngModel)]="editActStart" />
                                <input [class]="INPUT + ' w-36 h-8 text-xs'" type="datetime-local" [(ngModel)]="editActEnd" />
                                <button (click)="saveEditActivity(a.id)" [class]="BTN_PRIMARY + ' h-8 text-xs'">✓ Сохранить</button>
                                <button (click)="editingActivityId = null" [class]="BTN_GHOST + ' h-8 text-xs'">✕</button>
                              </div>
                            }
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
                @if (matHwModuleIds.length === 0 && matActivity.typeLabel !== 'КТ') {
                  <div>
                    <label class="block text-xs text-[#6B7280] mb-1">🔢 Количество задач</label>
                    <input type="number" min="0" [class]="INPUT + ' w-32'" placeholder="напр. 6"
                      [(ngModel)]="matTaskCount" />
                    <p class="text-[10px] text-[#9CA3AF] mt-1">Студенты отмечают задачу готовой по номеру (1…N).</p>
                  </div>
                }
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
                @if (courseStudentsOnly.length === 0 && courseAssistants.length === 0) {
                  <p class="px-5 py-4 text-sm text-[#9CA3AF]">Нет записанных на этом курсе</p>
                } @else {
                  @if (courseStudentsOnly.length > 0) {
                    <div class="px-5 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Студенты ({{ courseStudentsOnly.length }})</p>
                    </div>
                    <div class="divide-y divide-[#F3F4F6]">
                      @for (u of courseStudentsOnly; track u.id) {
                        <div class="flex items-center justify-between px-5 py-3">
                          <div>
                            <p class="text-sm font-medium text-[#1A1A1B]">{{ u.displayName }}</p>
                            <p class="text-xs text-[#6B7280]">{{ u.email }}</p>
                          </div>
                          <span class="text-xs text-[#059669] bg-[#D1FAE5] px-2 py-0.5 rounded-full">Студент</span>
                        </div>
                      }
                    </div>
                  }
                  @if (courseAssistants.length > 0) {
                    <div class="px-5 py-2 bg-[#FFFBEB] border-y border-[#FDE68A]">
                      <p class="text-xs font-semibold text-[#D97706] uppercase tracking-wide">Ассистенты ({{ courseAssistants.length }})</p>
                    </div>
                    <div class="divide-y divide-[#F3F4F6]">
                      @for (u of courseAssistants; track u.id) {
                        <div class="flex items-center justify-between px-5 py-3">
                          <div>
                            <p class="text-sm font-medium text-[#1A1A1B]">{{ u.displayName }}</p>
                            <p class="text-xs text-[#6B7280]">{{ u.email }}</p>
                          </div>
                          <span class="text-xs text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-full">Ассистент</span>
                        </div>
                      }
                    </div>
                  }
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
                          [class]="u.role === 'Teacher' ? 'bg-[#EAF2FF] text-[#005BFF]' : 'bg-[#FEF3C7] text-[#D97706]'">
                          {{ u.role === 'Teacher' ? 'Преподаватель' : 'Ассистент' }}
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
            <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Команды (лекции и ДЗ-сессии)</p>
            <div class="flex flex-wrap gap-3 items-end">
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Занятие</label>
                <select [class]="INPUT + ' pr-8 min-w-60'"
                  [(ngModel)]="teamsActivityId"
                  (ngModelChange)="onTeamsActivityChange($event)">
                  <option value="">— выберите занятие —</option>
                  @for (a of teamActivities; track a.id) {
                    <option [value]="a.id">М{{ a.moduleNumber }} / {{ a.typeLabel }} / {{ a.title }}</option>
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
              Авто-генерация: змейка по списку записанных студентов (текущие команды заменяются).
              Ниже можно создавать и редактировать команды вручную.
            </p>
            @if (teamActivities.length === 0 && !scheduleLoading) {
              <p class="text-xs text-[#EF4444] mt-2">Нет лекций/ДЗ-сессий в расписании.</p>
            }
            @if (teamsActivityId) {
              <div class="flex flex-wrap gap-2 items-end mt-3 pt-3 border-t border-[#F3F4F6]">
                <div>
                  <label class="block text-xs text-[#6B7280] mb-1">Название новой команды</label>
                  <input [class]="INPUT + ' w-44'" [(ngModel)]="newTeamName" placeholder="Команда N" />
                </div>
                <button (click)="createManualTeam()" [class]="BTN_GHOST">➕ Создать команду вручную</button>
              </div>
            }
          </div>

          @if (teamsLoading) { <p class="text-sm text-[#6B7280] animate-pulse">Загрузка команд...</p> }

          @if (!teamsLoading && teams.length > 0) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              @for (t of teams; track t.id) {
                <div class="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-sm font-semibold text-[#1A1A1B]">{{ t.name }}</p>
                    @if (editingTeamId !== t.id) {
                      <button (click)="startEditMembers(t)"
                        class="text-xs text-[#6B7280] hover:text-[#005BFF]">✏️ Состав</button>
                    }
                  </div>

                  @if (editingTeamId === t.id) {
                    <!-- Member editor -->
                    <div class="space-y-1 max-h-48 overflow-y-auto border border-[#E5E7EB] rounded-lg p-2 mb-2">
                      @if (teamStudents.length === 0) { <p class="text-xs text-[#9CA3AF]">Нет записанных студентов</p> }
                      @for (s of teamStudents; track s.id) {
                        <label class="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" [checked]="editTeamMemberIds.includes(s.id)" (change)="toggleMember(s.id)" class="accent-[#005BFF]" />
                          {{ s.displayName }}
                        </label>
                      }
                    </div>
                    <div class="flex gap-2">
                      <button (click)="saveTeamMembers(t.id)" [class]="BTN_PRIMARY + ' h-7 text-xs px-3'">✓ Сохранить</button>
                      <button (click)="editingTeamId = null" [class]="BTN_GHOST + ' h-7 text-xs px-2'">✕</button>
                    </div>
                  } @else {
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
                  }

                  <!-- Assistant assignment (#10) -->
                  <div class="mt-2 pt-2 border-t border-[#F3F4F6]">
                    <label class="block text-[10px] text-[#9CA3AF] mb-1">Ассистент команды</label>
                    <select [class]="INPUT + ' w-full h-8 text-xs'"
                      [ngModel]="t.assistants[0]?.assistantId ?? ''"
                      (ngModelChange)="assignAssistant(t.id, $event)">
                      <option value="">— не назначен —</option>
                      @for (a of teamAssistantOptions; track a.id) {
                        <option [value]="a.id">{{ a.displayName }}</option>
                      }
                    </select>
                    @if (teamAssistantOptions.length === 0) {
                      <p class="text-[10px] text-[#9CA3AF] mt-1">Нет одобренных ассистентов на это занятие.</p>
                    }
                  </div>
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

      <!-- ── TEMPLATES TAB ─────────────────────────────────────────────── -->
      @if (tab === 'templates') {
        <div class="space-y-6">

          <!-- Create template form -->
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
            <p class="text-sm font-semibold text-[#1A1A1B]">Создать шаблон предмета</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Название шаблона *</label>
                <input [class]="INPUT + ' w-full'" [(ngModel)]="tplTitle" placeholder="напр. Веб-разработка 2025" />
              </div>
              <div>
                <label class="block text-xs text-[#6B7280] mb-1">Описание</label>
                <input [class]="INPUT + ' w-full'" [(ngModel)]="tplDesc" placeholder="необязательно" />
              </div>
            </div>

            <!-- Modules editor -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <p class="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Модули</p>
                <button (click)="tplAddModule()" [class]="BTN_GHOST">+ Модуль</button>
              </div>
              @for (m of tplModules; track m; let mi = $index) {
                <div class="border border-[#E5E7EB] rounded-xl p-4 space-y-3 bg-[#FAFAFA]">
                  <div class="flex items-center gap-3 flex-wrap">
                    <span class="text-xs font-bold text-[#6B7280] w-6">М{{ mi + 1 }}</span>
                    <input [class]="INPUT + ' flex-1 min-w-40'" [(ngModel)]="m.title" placeholder="Название модуля" />
                    <input [class]="INPUT + ' w-36'" type="date" [(ngModel)]="m.startsAt" title="Начало модуля" />
                    <input [class]="INPUT + ' w-36'" type="date" [(ngModel)]="m.endsAt" title="Конец модуля" />
                    <button (click)="tplRemoveModule(mi)" class="text-[#EF4444] text-xs hover:underline">✕</button>
                  </div>

                  <!-- Activities in this module -->
                  <div class="space-y-2 pl-4">
                    @for (a of m.activities; track a; let ai = $index) {
                      <div class="flex items-center gap-2 flex-wrap">
                        <select [class]="INPUT + ' w-28'" [(ngModel)]="a.type">
                          <option value="1">Лекция</option>
                          <option value="2">КТ</option>
                          <option value="3">ДЗ-сессия</option>
                        </select>
                        <input [class]="INPUT + ' flex-1 min-w-32'" [(ngModel)]="a.title" placeholder="Название занятия" />
                        <button (click)="tplRemoveActivity(mi, ai)" class="text-[#EF4444] text-xs">✕</button>
                      </div>
                      <!-- Tasks for this activity -->
                      @if (a.tasks.length > 0) {
                        <div class="pl-4 pt-1 space-y-1">
                          @for (t of a.tasks; track t; let ti = $index) {
                            <div class="flex items-center gap-1.5">
                              <input [class]="INPUT + ' w-16 h-7 text-xs'" [(ngModel)]="t.code" placeholder="Код" />
                              <input [class]="INPUT + ' flex-1 h-7 text-xs'" [(ngModel)]="t.title" placeholder="Название задачи" />
                              <input [class]="INPUT + ' w-14 h-7 text-xs'" type="number" min="0.5" step="0.5" [(ngModel)]="t.points" placeholder="Балл" />
                              <button (click)="tplRemoveTask(mi, ai, ti)" class="text-[#EF4444] text-xs w-5">✕</button>
                            </div>
                          }
                        </div>
                      }
                      <button (click)="tplAddTask(mi, ai)" class="text-[10px] text-[#6B7280] hover:text-[#005BFF] ml-4 mt-0.5">+ задача</button>
                    }
                    <button (click)="tplAddActivity(mi)" class="text-xs text-[#005BFF] hover:underline">+ занятие</button>
                  </div>
                </div>
              }
              @if (tplModules.length === 0) {
                <p class="text-xs text-[#9CA3AF]">Нет модулей. Нажмите «+ Модуль».</p>
              }
            </div>

            <button (click)="saveTemplate()" [disabled]="tplSaving || !tplTitle" [class]="BTN_PRIMARY">
              {{ tplSaving ? '⏳ Сохранение...' : '💾 Сохранить шаблон' }}
            </button>
          </div>

          <!-- Templates list -->
          @if (templatesLoading) { <p class="text-sm text-[#6B7280] animate-pulse">Загрузка шаблонов...</p> }

          @if (!templatesLoading && templates.length === 0) {
            <p class="text-sm text-[#9CA3AF]">Нет шаблонов. Создайте первый выше.</p>
          }

          @for (tpl of templates; track tpl.id) {
            <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div class="px-5 py-4 flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-[#1A1A1B]">{{ tpl.title }}</p>
                  @if (tpl.description) { <p class="text-xs text-[#6B7280] mt-0.5">{{ tpl.description }}</p> }
                  <p class="text-xs text-[#9CA3AF] mt-1">
                    {{ tpl.moduleCount }} модул. · {{ tpl.activityCount }} занятий ·
                    создан {{ fmtDateShort(tpl.createdAt) }}
                  </p>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                  <button (click)="viewTemplate(tpl.id)"
                    class="h-8 px-3 rounded-lg bg-[#EAF2FF] text-[#005BFF] text-xs font-medium hover:bg-[#D1E6FF] transition-colors">
                    {{ expandedTpl === tpl.id ? '▲ Скрыть' : '▼ Структура' }}
                  </button>
                  <button (click)="openApplyDialog(tpl)" [class]="BTN_PRIMARY + ' h-8 text-xs'">
                    ▶ Применить
                  </button>
                  <button (click)="deleteTemplate(tpl)" class="h-8 px-3 rounded-lg border border-[#FCA5A5] text-[#EF4444] text-xs hover:bg-[#FEF2F2] transition-colors">
                    ✕
                  </button>
                </div>
              </div>

              <!-- Expanded template structure -->
              @if (expandedTpl === tpl.id && tplDetail) {
                <div class="border-t border-[#F3F4F6] px-5 py-4 space-y-3">
                  @for (m of tplDetail.modules; track m.id) {
                    <div>
                      <p class="text-xs font-semibold text-[#1A1A1B] mb-1">М{{ m.number }} — {{ m.title }}</p>
                      <div class="space-y-1 pl-3">
                        @for (a of m.activities; track a.id) {
                          <div class="flex items-center gap-2">
                            <span class="text-xs px-2 py-0.5 rounded-md font-medium"
                              [class]="actTypeClass(a.type)">{{ actTypeLabelNum(a.type) }}</span>
                            <span class="text-xs text-[#1A1A1B]">{{ a.title }}</span>
                            @if (a.tasks.length > 0) {
                              <span class="text-xs text-[#6B7280]">({{ a.tasks.length }} задач)</span>
                            }
                          </div>
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
      <!-- ══ MODALS (вне вкладок, чтобы открывались на любой вкладке) ══ -->

          <!-- Delete course confirmation (B1) -->
          @if (deleteCourseModal) {
            <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="deleteCourseModal = false">
              <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" (click)="$event.stopPropagation()">
                <p class="font-semibold text-[#1A1A1B]">🗑 Удалить курс</p>
                <p class="text-sm text-[#6B7280]">
                  Курс <strong>{{ deleteCourseCode }}</strong> будет удалён вместе со всеми модулями,
                  занятиями, задачами и командами. Это действие необратимо.
                </p>
                <div class="flex gap-2 pt-1">
                  <button (click)="deleteCourseModal = false" [class]="BTN_GHOST + ' flex-1'">Отмена</button>
                  <button (click)="confirmDeleteCourse()"
                    class="flex-1 h-9 rounded-lg bg-[#DC2626] text-white text-sm font-medium hover:bg-[#B91C1C] transition-colors">
                    Удалить курс
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Invite link modal -->
          @if (inviteModal) {
            <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="inviteModal = false">
              <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" (click)="$event.stopPropagation()">
                <p class="font-semibold text-[#1A1A1B]">🔗 Ссылка-приглашение</p>
                <p class="text-sm text-[#6B7280]">Отправьте эту ссылку студентам. Только по ней можно записаться на курс.</p>
                <div class="flex gap-2 items-center">
                  <input [value]="inviteLink" readonly
                    class="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-xs text-[#1A1A1B] bg-[#F9FAFB] outline-none" />
                  <button (click)="copyInvite()"
                    class="h-9 px-3 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] transition-colors flex-shrink-0">
                    {{ copied ? '✓' : '📋 Копировать' }}
                  </button>
                </div>
                <div class="flex gap-2 pt-1">
                  <button (click)="inviteModal = false" [class]="BTN_GHOST + ' flex-1'">Закрыть</button>
                  <button (click)="regenerateInvite()" [disabled]="inviteRegenerating"
                    class="flex-1 h-9 rounded-lg border border-[#FCA5A5] text-[#EF4444] text-xs font-medium hover:bg-[#FEF2F2] transition-colors disabled:opacity-60">
                    {{ inviteRegenerating ? '⏳...' : '🔄 Новый код' }}
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Save as template dialog -->
          @if (saveAsTplModal) {
            <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="saveAsTplModal = false">
              <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" (click)="$event.stopPropagation()">
                <p class="font-semibold text-[#1A1A1B]">💾 Сохранить как шаблон</p>
                <p class="text-sm text-[#6B7280]">Структура курса (модули, занятия, задачи) будет сохранена как шаблон для повторного использования.</p>
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs text-[#6B7280] mb-1">Название шаблона *</label>
                    <input [class]="INPUT + ' w-full'" [(ngModel)]="saveAsTplTitle" placeholder="напр. Математика ч.2" />
                  </div>
                  <div>
                    <label class="block text-xs text-[#6B7280] mb-1">Описание</label>
                    <input [class]="INPUT + ' w-full'" [(ngModel)]="saveAsTplDesc" placeholder="необязательно" />
                  </div>
                </div>
                <div class="flex gap-2 pt-1">
                  <button (click)="saveAsTplModal = false" [class]="BTN_GHOST + ' flex-1'">Отмена</button>
                  <button (click)="saveAsTemplate()" [disabled]="saveAsTplSaving || !saveAsTplTitle"
                    [class]="BTN_PRIMARY + ' flex-1 bg-[#7C3AED] hover:bg-[#6D28D9]'">
                    {{ saveAsTplSaving ? '⏳...' : '💾 Сохранить' }}
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Apply template dialog -->
          @if (applyTpl) {
            <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="applyTpl = null">
              <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" (click)="$event.stopPropagation()">
                <p class="font-semibold text-[#1A1A1B]">Применить шаблон</p>
                <p class="text-sm text-[#6B7280]">Шаблон: <strong>{{ applyTpl.title }}</strong></p>
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs text-[#6B7280] mb-1">Код курса *</label>
                    <input [class]="INPUT + ' w-full'" [(ngModel)]="applyCode" placeholder="напр. WEB-25" />
                  </div>
                  <div>
                    <label class="block text-xs text-[#6B7280] mb-1">Название курса *</label>
                    <input [class]="INPUT + ' w-full'" [(ngModel)]="applyTitle" placeholder="Веб-разработка 2025" />
                  </div>
                  <div>
                    <label class="block text-xs text-[#6B7280] mb-1">Учебный год *</label>
                    <input [class]="INPUT + ' w-full'" [(ngModel)]="applyYear" placeholder="2025/2026" />
                  </div>
                  <div>
                    <label class="block text-xs text-[#6B7280] mb-1">Дата начала первого модуля</label>
                    <input [class]="INPUT + ' w-full'" type="date" [(ngModel)]="applyStartDate" />
                    <p class="text-[10px] text-[#9CA3AF] mt-1">Все даты из шаблона сдвинутся на этот день. Если не указать — используются даты шаблона или сегодня.</p>
                  </div>
                </div>
                <p class="text-xs text-[#6B7280]">
                  После создания отредактируйте даты занятий во вкладке «Структура» (кнопка ✏️ Даты рядом с каждым модулем).
                </p>
                <div class="flex gap-2 pt-1">
                  <button (click)="applyTpl = null" [class]="BTN_GHOST + ' flex-1'">Отмена</button>
                  <button (click)="applyTemplate()" [disabled]="applying || !applyCode || !applyTitle" [class]="BTN_PRIMARY + ' flex-1'">
                    {{ applying ? '⏳...' : '▶ Создать курс' }}
                  </button>
                </div>
              </div>
            </div>
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
  matVideoUrl = ''; matTestUrl = ''; matFileUrl = ''; matTaskCount = '';
  matSaving = false;
  matHwModuleIds: string[] = [];
  nonHwActivities: TeacherActivity[] = [];
  hwByModule: Map<string, TeacherActivity[]> = new Map();

  // Delete-course modal (B1)
  deleteCourseModal = false;
  deleteCourseId = '';
  deleteCourseCode = '';

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
  // Manual team management (#9/#10)
  teamStudents: { id: string; displayName: string }[] = [];
  teamAssistantOptions: { id: string; displayName: string }[] = [];
  newTeamName = '';
  editingTeamId: string | null = null;
  editTeamMemberIds: string[] = [];

  // Templates tab
  templates: TemplateSummary[] = [];
  templatesLoading = false;
  tplTitle = ''; tplDesc = '';
  tplModules: { title: string; startsAt: string; endsAt: string; activities: { type: string; title: string; tasks: { code: string; title: string; points: string }[] }[] }[] = [];
  tplSaving = false;
  expandedTpl: string | null = null;
  tplDetail: TemplateView | null = null;
  applyTpl: TemplateSummary | null = null;
  applyCode = ''; applyTitle = ''; applyYear = defaultAcademicYear(); applyStartDate = '';
  applying = false;

  // Save-as-template modal
  saveAsTplModal = false;
  saveAsTplTitle = ''; saveAsTplDesc = ''; saveAsTplSaving = false;

  // Inline module/activity editing
  editingModuleId: string | null = null;
  editModuleTitle = ''; editModuleStart = ''; editModuleEnd = '';
  editingActivityId: string | null = null;
  editActTitle = ''; editActStart = ''; editActEnd = '';

  // Invite modal
  inviteModal = false;
  inviteLink = '';
  inviteCourseId = '';
  inviteRegenerating = false;
  copied = false;

  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'courses', label: 'Курсы' },
    { key: 'structure', label: 'Структура' },
    { key: 'materials', label: 'Задания' },
    { key: 'students', label: 'Студенты/Персонал' },
    { key: 'scores', label: 'Баллы' },
    { key: 'schedule', label: 'Расписание' },
    { key: 'teams', label: 'Команды' },
    { key: 'templates', label: '📋 Шаблоны' },
  ];

  get allStudents() { return this.allUsers.filter(u => u.role === 'Student'); }
  get allStaff() { return this.allUsers.filter(u => ['Teacher', 'Assistant'].includes(u.role)); }
  get courseStudentsOnly() { return this.courseStudents.filter(u => u.role === 'Student'); }
  get courseAssistants() { return this.courseStudents.filter(u => u.role === 'Assistant'); }
  get lectureActivities() { return this.scheduleActivities.filter(a => a.typeLabel === 'Лекция'); }
  // Командные занятия: лекции и ДЗ-сессии, ещё не прошедшие (нельзя формировать команды для прошедших).
  get teamActivities() {
    const now = Date.now();
    return this.scheduleActivities.filter(a =>
      (a.typeLabel === 'Лекция' || a.typeLabel === 'ДЗ-сессия') && new Date(a.endsAt).getTime() > now);
  }

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

  openDeleteCourse(courseId: string, code: string) {
    this.deleteCourseId = courseId;
    this.deleteCourseCode = code;
    this.deleteCourseModal = true;
  }

  async confirmDeleteCourse() {
    try {
      await this.api.deleteCourse(this.deleteCourseId);
      this.toast.success('Курс удалён');
      if (this.selected === this.deleteCourseId) this.selected = null;
      this.deleteCourseModal = false;
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
    this.matTaskCount = act.taskCount ? String(act.taskCount) : '';
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
          taskCount: this.matTaskCount === '' ? undefined : Math.max(0, parseInt(this.matTaskCount) || 0),
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
      // Перезагружаем через getTeams: ответ autoGenerate имеет другую форму members,
      // поэтому показываем команды сразу в корректном виде, без перезагрузки страницы.
      await this.onTeamsActivityChange(this.teamsActivityId);
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
    finally { this.generating = false; }
  }

  async onTeamsActivityChange(actId: string) {
    this.editingTeamId = null;
    if (!actId) { this.teams = []; this.teamStudents = []; this.teamAssistantOptions = []; return; }
    this.teamsLoading = true;
    try {
      this.teams = await this.api.getTeams(actId);
      // Подгружаем записанных студентов курса и одобренных ассистентов занятия
      if (this.selected) {
        this.api.courseStudents(this.selected)
          .then(list => this.teamStudents = list.filter(s => s.role === 'Student').map(s => ({ id: s.id, displayName: s.displayName })))
          .catch(() => this.teamStudents = []);
      }
      this.api.approvedAssistants(actId)
        .then(apps => this.teamAssistantOptions = apps
          .filter(a => a.status === 'Approved')
          .map(a => ({ id: a.assistantId, displayName: a.assistantName })))
        .catch(() => this.teamAssistantOptions = []);
    }
    catch { this.teams = []; }
    finally { this.teamsLoading = false; }
  }

  // ── Manual team management (#9/#10) ───────────────────────────────────────
  async createManualTeam() {
    if (!this.teamsActivityId) { this.toast.error('Выберите занятие'); return; }
    const name = this.newTeamName.trim() || `Команда ${this.teams.length + 1}`;
    try {
      await this.api.createTeam(this.teamsActivityId, name);
      this.newTeamName = '';
      await this.onTeamsActivityChange(this.teamsActivityId);
      this.toast.success('Команда создана');
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  startEditMembers(t: ActivityTeam) {
    this.editingTeamId = t.id;
    this.editTeamMemberIds = t.members.map(m => m.userId);
  }

  toggleMember(userId: string) {
    this.editTeamMemberIds = this.editTeamMemberIds.includes(userId)
      ? this.editTeamMemberIds.filter(id => id !== userId)
      : [...this.editTeamMemberIds, userId];
  }

  async saveTeamMembers(teamId: string) {
    try {
      await this.api.setTeamMembers(teamId, this.editTeamMemberIds);
      this.editingTeamId = null;
      await this.onTeamsActivityChange(this.teamsActivityId);
      this.toast.success('Состав команды обновлён');
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async assignAssistant(teamId: string, assistantId: string) {
    try {
      await this.api.setTeamAssistants(teamId, assistantId ? [assistantId] : []);
      await this.onTeamsActivityChange(this.teamsActivityId);
      this.toast.success(assistantId ? 'Ассистент назначен' : 'Ассистент снят');
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  // Tab change — load data
  setTab(t: Tab) {
    this.tab = t;
    if (t === 'students') this.loadAllUsers();
    if (t === 'templates') this.loadTemplates();
    this.onCourseChange();
  }

  // ── Template methods ──────────────────────────────────────────────────────
  async loadTemplates() {
    this.templatesLoading = true;
    try { this.templates = await this.api.listTemplates(); }
    catch { this.templates = []; }
    finally { this.templatesLoading = false; }
  }

  tplAddModule() {
    this.tplModules.push({ title: '', startsAt: '', endsAt: '', activities: [] });
  }
  tplRemoveModule(i: number) { this.tplModules.splice(i, 1); }
  tplAddActivity(mi: number) { this.tplModules[mi].activities.push({ type: '1', title: '', tasks: [] }); }
  tplAddTask(mi: number, ai: number) { this.tplModules[mi].activities[ai].tasks.push({ code: '', title: '', points: '1' }); }
  tplRemoveTask(mi: number, ai: number, ti: number) { this.tplModules[mi].activities[ai].tasks.splice(ti, 1); }
  tplRemoveActivity(mi: number, ai: number) { this.tplModules[mi].activities.splice(ai, 1); }

  async saveTemplate() {
    if (!this.tplTitle) { this.toast.error('Введите название шаблона'); return; }
    this.tplSaving = true;
    try {
      const body = {
        title: this.tplTitle,
        description: this.tplDesc || null,
        modules: this.tplModules.map((m, i) => ({
          number: i + 1,
          title: m.title || `Модуль ${i + 1}`,
          startsAt: m.startsAt ? new Date(m.startsAt).toISOString() : null,
          endsAt: m.endsAt ? new Date(m.endsAt).toISOString() : null,
          activities: m.activities.map(a => ({
            type: parseInt(a.type),
            title: a.title || 'Занятие',
            taskFileUrl: null, theoryTestUrl: null,
            tasks: (a.tasks ?? []).filter(t => t.code || t.title).map(t => ({
              code: t.code || `T${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
              title: t.title || 'Задача',
              points: parseFloat(t.points) || 1
            }))
          }))
        }))
      };
      await this.api.createTemplate(body);
      this.toast.success('Шаблон сохранён');
      this.tplTitle = ''; this.tplDesc = ''; this.tplModules = [];
      await this.loadTemplates();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
    finally { this.tplSaving = false; }
  }

  async viewTemplate(id: string) {
    if (this.expandedTpl === id) { this.expandedTpl = null; this.tplDetail = null; return; }
    try {
      this.tplDetail = await this.api.getTemplate(id);
      this.expandedTpl = id;
    } catch { this.toast.error('Ошибка загрузки шаблона'); }
  }

  openApplyDialog(tpl: TemplateSummary) {
    this.applyTpl = tpl;
    this.applyCode = ''; this.applyTitle = tpl.title; this.applyYear = defaultAcademicYear(); this.applyStartDate = '';
  }

  async applyTemplate() {
    if (!this.applyTpl || !this.applyCode || !this.applyTitle) return;
    this.applying = true;
    try {
      const { courseId } = await this.api.applyTemplate(this.applyTpl.id, {
        courseCode: this.applyCode, courseTitle: this.applyTitle, academicYear: this.applyYear,
        startDate: this.applyStartDate ? new Date(this.applyStartDate).toISOString() : undefined
      });
      this.toast.success('Курс создан из шаблона!');
      this.applyTpl = null;
      await this.loadCourses();
      this.selected = courseId;
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
    finally { this.applying = false; }
  }

  async deleteTemplate(tpl: TemplateSummary) {
    if (!confirm(`Удалить шаблон «${tpl.title}»?`)) return;
    try {
      await this.api.deleteTemplate(tpl.id);
      this.toast.success('Шаблон удалён');
      if (this.expandedTpl === tpl.id) { this.expandedTpl = null; this.tplDetail = null; }
      await this.loadTemplates();
    } catch { this.toast.error('Ошибка удаления'); }
  }

  // ── Inline module editing ────────────────────────────────────────────────
  startEditModule(m: { id: string; title: string; startsAt: string; endsAt: string }) {
    this.editingModuleId = m.id;
    this.editModuleTitle = m.title;
    this.editModuleStart = m.startsAt ? m.startsAt.slice(0, 10) : '';
    this.editModuleEnd   = m.endsAt   ? m.endsAt.slice(0, 10)   : '';
  }

  async saveEditModule(moduleId: string) {
    try {
      await this.api.patchModule(moduleId, {
        title: this.editModuleTitle || undefined,
        startsAt: this.editModuleStart ? new Date(this.editModuleStart).toISOString() : undefined,
        endsAt:   this.editModuleEnd   ? new Date(this.editModuleEnd).toISOString()   : undefined,
      });
      this.toast.success('Модуль обновлён');
      this.editingModuleId = null;
      await this.loadStructure();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  // ── Inline activity editing ───────────────────────────────────────────────
  startEditActivity(a: { id: string; title: string; startsAt: string; endsAt: string }) {
    this.editingActivityId = a.id;
    this.editActTitle = a.title;
    this.editActStart = a.startsAt ? a.startsAt.slice(0, 16) : ''; // datetime-local needs YYYY-MM-DDTHH:mm
    this.editActEnd   = a.endsAt   ? a.endsAt.slice(0, 16)   : '';
  }

  async saveEditActivity(activityId: string) {
    try {
      await this.api.patchActivity(activityId, {
        title:    this.editActTitle   || undefined,
        startsAt: this.editActStart   ? new Date(this.editActStart).toISOString()   : undefined,
        endsAt:   this.editActEnd     ? new Date(this.editActEnd).toISOString()     : undefined,
      });
      this.toast.success('Занятие обновлено');
      this.editingActivityId = null;
      await this.loadStructure();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  // ── Save course as template ───────────────────────────────────────────────
  openSaveAsTemplate() {
    const course = this.courseList.find(c => c.id === this.selected);
    this.saveAsTplTitle = course ? course.title : '';
    this.saveAsTplDesc = '';
    this.saveAsTplModal = true;
  }

  async saveAsTemplate() {
    if (!this.selected || !this.saveAsTplTitle) return;
    this.saveAsTplSaving = true;
    try {
      await this.api.saveAsTemplate(this.selected, { title: this.saveAsTplTitle, description: this.saveAsTplDesc || undefined });
      this.toast.success('Шаблон сохранён! Открываю вкладку «Шаблоны».');
      this.saveAsTplModal = false;
      this.setTab('templates');
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
    finally { this.saveAsTplSaving = false; }
  }

  totalActivities(structure: { modules: { activities: unknown[] }[] }) {
    return structure.modules.reduce((sum, m) => sum + m.activities.length, 0);
  }

  // ── Invite link ──────────────────────────────────────────────────────────
  async showInvite(courseId: string) {
    this.inviteCourseId = courseId;
    this.copied = false;
    try {
      const r = await this.api.getCourseInvite(courseId);
      this.inviteLink = `${window.location.origin}/join/${r.inviteCode}`;
      this.inviteModal = true;
    } catch { this.toast.error('Не удалось получить ссылку'); }
  }

  async copyInvite() {
    try {
      await navigator.clipboard.writeText(this.inviteLink);
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    } catch { this.toast.error('Не удалось скопировать'); }
  }

  async regenerateInvite() {
    if (!confirm('Старая ссылка перестанет работать. Продолжить?')) return;
    this.inviteRegenerating = true;
    try {
      const r = await this.api.regenerateCourseInvite(this.inviteCourseId);
      this.inviteLink = `${window.location.origin}/join/${r.inviteCode}`;
      this.copied = false;
      this.toast.success('Новый код создан');
    } catch { this.toast.error('Ошибка'); }
    finally { this.inviteRegenerating = false; }
  }

  actTypeClass(type: number) {
    // ActivityType 1-индексный: 1=Лекция, 2=КТ, 3=ДЗ-сессия
    const map: Record<number, string> = { 1: 'bg-[#EAF2FF] text-[#005BFF]', 2: 'bg-[#FEF3C7] text-[#D97706]', 3: 'bg-[#F3E8FF] text-[#7C3AED]' };
    return map[type] ?? 'bg-[#F3F4F6] text-[#6B7280]';
  }
  actTypeLabelNum(type: number) {
    const map: Record<number, string> = { 1: 'Лекция', 2: 'КТ', 3: 'ДЗ-сессия' };
    return map[type] ?? 'Занятие';
  }
  fmtDateShort(d: string) { return new Date(d).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' }); }

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
