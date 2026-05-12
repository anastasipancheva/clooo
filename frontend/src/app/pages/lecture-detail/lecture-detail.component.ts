import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SignalRService } from '../../core/signalr.service';
import { ToastService } from '../../core/toast.service';
import { MiniTestDto } from '../../core/models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-lecture-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">Лекция</h1>

      <!-- Mini-test active -->
      @if (miniTest && !testSubmitted && miniTest.isOpen && secondsLeft > 0) {
        <div class="bg-white rounded-xl border border-[#C7DCFF] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#C7DCFF] bg-[#EAF2FF] flex items-center justify-between">
            <span class="text-sm font-semibold text-[#005BFF]">Мини-тест</span>
            <span class="text-sm font-mono font-bold text-[#D97706] bg-[#FEF3C7] px-2.5 py-1 rounded-lg">
              {{ fmt(secondsLeft) }}
            </span>
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

      <!-- Test submitted -->
      @if (testSubmitted) {
        <div class="bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl px-5 py-4">
          <p class="text-sm font-semibold text-[#059669]">Тест сдан!</p>
        </div>
      }

      <!-- Team actions -->
      <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <p class="text-sm font-semibold text-[#1A1A1B] mb-1">Команда</p>
        <p class="text-xs text-[#6B7280] mb-4">
          Вызовите ассистента на консультацию или отметьте задачу готовой.
        </p>
        <button (click)="callAssistant()" [disabled]="!teamId"
          class="h-10 px-5 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] font-medium hover:border-[#005BFF] hover:text-[#005BFF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          Позвать ассистента
        </button>
        @if (!teamId) {
          <p class="text-xs text-[#9CA3AF] mt-2">
            teamId будет подтянут через API курса (GET /api/activities/&#123;activityId&#125;/my-team).
          </p>
        }
      </div>

      <!-- Tasks -->
      @if (tasks.length > 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#E5E7EB]">
            <p class="text-sm font-semibold text-[#1A1A1B]">Задачи</p>
          </div>
          <div class="divide-y divide-[#F3F4F6]">
            @for (t of tasks; track t.id) {
              <div class="flex items-center justify-between px-5 py-3">
                <span class="text-sm font-mono font-medium text-[#1A1A1B]">{{ t.code }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium px-2.5 py-1 rounded-full" [class]="taskStatusClass(t.status)">
                    {{ t.status }}
                  </span>
                  @if (t.status !== 'Accepted') {
                    <button (click)="markReady(t.id)"
                      class="h-8 px-3 rounded-lg border border-[#E5E7EB] text-xs text-[#6B7280] font-medium hover:border-[#005BFF] hover:text-[#005BFF] transition-colors">
                      Готовы сдать
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class LectureDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private signalr = inject(SignalRService);
  private toast = inject(ToastService);

  activityId = '';
  teamId: string | null = null;
  tasks: { id: string; code: string; status: string }[] = [];
  miniTest: MiniTestDto | null = null;
  answers: Record<string, number> = {};
  testSubmitted = false;
  secondsLeft = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sub?: Subscription;

  ngOnInit() {
    this.activityId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadMiniTest();
    this.sub = this.signalr.notification$.subscribe(payload => {
      if (payload.type === 'MiniTestOpened') this.loadMiniTest();
      if (payload.type === 'TaskAccepted') this.toast.success(payload.title);
      if (payload.type === 'TaskRejected') this.toast.error(payload.title);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    if (this.timer) clearInterval(this.timer);
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

  setAnswer(questionId: string, idx: number) {
    this.answers = { ...this.answers, [questionId]: idx };
  }

  async submitTest() {
    const ans = Object.entries(this.answers).map(([questionId, selectedOptionIndex]) => ({ questionId, selectedOptionIndex }));
    try {
      await this.api.submitMiniTest(this.activityId, ans);
      this.testSubmitted = true;
      this.toast.success('Тест сдан!');
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async callAssistant() {
    if (!this.teamId) return;
    try {
      await this.api.requestHelp(this.teamId);
      this.toast.success('Ассистент вызван!');
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async markReady(taskItemId: string) {
    if (!this.teamId) return;
    try {
      await this.api.markTeamTaskReady(this.teamId, taskItemId);
      this.toast.success('Ассистент уведомлён о готовности');
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
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
