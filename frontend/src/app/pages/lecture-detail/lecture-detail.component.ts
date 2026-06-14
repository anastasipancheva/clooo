import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SignalRService } from '../../core/signalr.service';
import { ToastService } from '../../core/toast.service';
import { MiniTestDto } from '../../core/models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-lecture-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5 max-w-2xl">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">Лекция</h1>

      <!-- Mini-test active -->
      @if (miniTest && !testSubmitted && miniTest.isOpen && secondsLeft > 0) {
        <div class="bg-white rounded-xl border border-[#C7DCFF] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#C7DCFF] bg-[#EAF2FF] flex items-center justify-between">
            <span class="text-sm font-semibold text-[#005BFF]">Мини-тест</span>
            <span class="text-sm font-mono font-bold text-[#D97706] bg-[#FEF3C7] px-2.5 py-1 rounded-lg">{{ fmt(secondsLeft) }}</span>
          </div>
          <div class="p-5 space-y-5">
            @for (q of miniTest.questions; track q.id) {
              <div>
                <p class="text-sm font-medium text-[#1A1A1B] mb-2">{{ q.order }}. {{ q.text }}</p>
                <div class="space-y-1.5">
                  @for (opt of q.options; track $index) {
                    <label class="flex items-center gap-3 text-sm cursor-pointer px-3 py-2 rounded-lg border transition-colors"
                      [class]="answers[q.id] === $index
                        ? 'border-[#005BFF] bg-[#EAF2FF] text-[#005BFF]'
                        : 'border-[#E5E7EB] text-[#1A1A1B] hover:border-[#005BFF]/40'">
                      <input type="radio" [name]="q.id" [value]="$index"
                        [checked]="answers[q.id] === $index"
                        (change)="setAnswer(q.id, $index)"
                        class="accent-[#005BFF]" />
                      {{ opt }}
                    </label>
                  }
                </div>
              </div>
            }
            <button (click)="submitTest()"
              class="h-10 px-5 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] transition-colors">
              Сдать тест
            </button>
          </div>
        </div>
      }

      @if (testSubmitted) {
        <div class="bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl px-5 py-4">
          <p class="text-sm font-semibold text-[#059669]">✓ Тест сдан!</p>
        </div>
      }

      <!-- Materials (#15 / #B7): video before start; test & tasks only after start -->
      @if (preLectureVideoUrl || theoryTestUrl || taskFileUrl) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-3">
          <p class="text-sm font-semibold text-[#1A1A1B]">Материалы занятия</p>
          <div class="flex flex-col gap-2">
            @if (preLectureVideoUrl) {
              <a [href]="preLectureVideoUrl" target="_blank" rel="noopener"
                class="inline-flex items-center gap-2 text-sm text-[#005BFF] hover:underline">
                🎬 Видео к лекции
              </a>
            }
            @if (started) {
              @if (theoryTestUrl) {
                <a [href]="theoryTestUrl" target="_blank" rel="noopener"
                  class="inline-flex items-center gap-2 text-sm text-[#005BFF] hover:underline">
                  📝 Тест по теории
                </a>
              }
              @if (taskFileUrl) {
                <a [href]="taskFileUrl" target="_blank" rel="noopener"
                  class="inline-flex items-center gap-2 text-sm text-[#005BFF] hover:underline">
                  📄 Файл с задачами
                </a>
              }
            } @else if (theoryTestUrl || taskFileUrl) {
              <p class="text-xs text-[#9CA3AF]">Тест и файл с задачами станут доступны после начала занятия.</p>
            }
          </div>
        </div>
      }

      <!-- Team actions: call assistant + mark task ready -->
      <div class="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-[#1A1A1B]">Команда {{ teamName ? '«' + teamName + '»' : '' }}</p>
          @if (assistantName) {
            <span class="text-xs text-[#6B7280]">Ассистент: <span class="font-medium text-[#1A1A1B]">{{ assistantName }}</span></span>
          }
        </div>

        @if (!teamId && !teamLoading) {
          <p class="text-xs text-[#9CA3AF]">Вы ещё не в команде. Обратитесь к преподавателю.</p>
        }
        @if (teamLoading) {
          <p class="text-xs text-[#9CA3AF] animate-pulse">Загрузка...</p>
        }

        @if (teamId && !started) {
          <p class="text-xs text-[#9CA3AF]">Действия команды станут доступны после начала занятия преподавателем.</p>
        }

        @if (teamId && started) {
          <!-- Call assistant (#B8 — only when started) -->
          <button (click)="callAssistant()"
            class="h-10 px-5 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] font-medium hover:border-[#005BFF] hover:text-[#005BFF] transition-colors">
            🙋 Позвать ассистента
          </button>

          <!-- Mark task ready with task number -->
          <div class="space-y-2">
            <p class="text-xs font-medium text-[#6B7280]">
              Отметить задачу готовой@if (taskCount > 0) { <span> (всего задач: {{ taskCount }})</span> }
            </p>
            @if (taskCount > 0) {
              <div class="flex gap-2 items-center">
                <input type="number" min="1" [max]="taskCount" [(ngModel)]="taskNumber"
                  [placeholder]="'№ задачи (1–' + taskCount + ')'"
                  class="w-44 h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF]" />
                <button (click)="markReadyByNumber()" [disabled]="!taskNumber || taskNumber < 1 || taskNumber > taskCount"
                  class="h-9 px-4 rounded-lg bg-[#059669] text-white text-xs font-semibold hover:bg-[#047857] disabled:opacity-50 transition-colors">
                  ✓ Готово
                </button>
              </div>
              <p class="text-[11px] text-[#9CA3AF]">Тот, кто отметит задачу готовой, будет её защищать у ассистента.</p>
            } @else {
              <p class="text-xs text-[#9CA3AF]">Преподаватель ещё не указал количество задач.</p>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class LectureDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private signalr = inject(SignalRService);
  private toast = inject(ToastService);

  activityId = '';
  teamId: string | null = null;
  teamName: string | null = null;
  teamLoading = true;
  taskNumber: number | null = null;
  taskCount = 0;
  activityStatus: string | null = null;
  preLectureVideoUrl: string | null = null;
  theoryTestUrl: string | null = null;
  taskFileUrl: string | null = null;
  assistantName: string | null = null;
  miniTest: MiniTestDto | null = null;
  answers: Record<string, number> = {};
  testSubmitted = false;
  secondsLeft = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sub?: Subscription;

  get started() { return this.activityStatus === 'Active'; }

  ngOnInit() {
    this.activityId = this.route.snapshot.paramMap.get('id') ?? '';

    // Redirect assistants to their own interface
    if (this.auth.isAssistant()) {
      this.router.navigate(['/assistant/session', this.activityId], { replaceUrl: true });
      return;
    }

    this.loadTeam();
    this.loadMiniTest();

    this.sub = this.signalr.notification$.subscribe(payload => {
      if (payload.type === 'MiniTestOpened') this.loadMiniTest();
      if (payload.type === 'TaskAccepted') { this.toast.success(payload.title); this.loadTeam(); }
      if (payload.type === 'TaskRejected') { this.toast.error(payload.title); this.loadTeam(); }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    if (this.timer) clearInterval(this.timer);
  }

  async loadTeam() {
    this.teamLoading = true;
    try {
      const data = await this.api.getMyTeam(this.activityId);
      this.teamId = data.teamId;
      this.teamName = data.teamName ?? null;
      this.taskCount = data.taskCount ?? 0;
      this.activityStatus = data.activityStatus ?? null;
      this.preLectureVideoUrl = data.preLectureVideoUrl ?? null;
      this.theoryTestUrl = data.theoryTestUrl ?? null;
      this.taskFileUrl = data.taskFileUrl ?? null;
      this.assistantName = data.assistantName ?? null;
    } catch { this.teamId = null; }
    finally { this.teamLoading = false; }
  }

  async loadMiniTest() {
    try {
      const data = await this.api.getMiniTest(this.activityId);
      this.miniTest = data;
      this.secondsLeft = data.secondsRemaining;
      this.startTimer();
    } catch {}
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    if (!this.miniTest?.isOpen || this.secondsLeft <= 0) return;
    this.timer = setInterval(() => {
      this.secondsLeft = Math.max(0, this.secondsLeft - 1);
      if (this.secondsLeft === 0 && this.timer) clearInterval(this.timer);
    }, 1000);
  }

  setAnswer(questionId: string, idx: number) { this.answers = { ...this.answers, [questionId]: idx }; }

  async submitTest() {
    const ans = Object.entries(this.answers).map(([questionId, selectedOptionIndex]) => ({ questionId, selectedOptionIndex }));
    try {
      await this.api.submitMiniTest(this.activityId, ans);
      this.testSubmitted = true;
      this.toast.success('Тест сдан!');
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async callAssistant() {
    if (!this.teamId) return;
    try {
      await this.api.requestHelp(this.teamId);
      this.toast.success('Ассистент вызван!');
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async markReadyByNumber() {
    if (!this.teamId || !this.taskNumber) return;
    if (this.taskNumber < 1 || this.taskNumber > this.taskCount) {
      this.toast.error(`Номер задачи должен быть от 1 до ${this.taskCount}`); return;
    }
    try {
      await this.api.markTeamTaskReadyByNumber(this.teamId, this.taskNumber);
      this.toast.success(`Задача №${this.taskNumber} отмечена готовой`);
      this.loadTeam();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  taskStatusClass(status: string) {
    const map: Record<string, string> = {
      Accepted: 'bg-[#D1FAE5] text-[#059669]',
      InReview: 'bg-[#EAF2FF] text-[#005BFF]',
      Rejected: 'bg-[#FEE2E2] text-[#DC2626]',
    };
    return map[status] ?? 'bg-[#F3F4F6] text-[#6B7280]';
  }
}
