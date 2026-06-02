import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SignalRService } from '../../core/signalr.service';
import { ToastService } from '../../core/toast.service';
import { MiniTestDto, MyTeamDto } from '../../core/models';
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
      @if (team) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
          <div>
            <p class="text-sm font-semibold text-[#1A1A1B] mb-1">{{ team.name }}</p>
            <p class="text-xs text-[#6B7280] mb-3">
              Вызовите ассистента на консультацию или отметьте задачу готовой.
            </p>
            <button (click)="callAssistant()"
              class="h-10 px-5 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] font-medium hover:border-[#005BFF] hover:text-[#005BFF] transition-colors">
              📢 Позвать ассистента
            </button>
          </div>

          <!-- Tasks -->
          @if (team.tasks.length > 0) {
            <div class="border border-[#E5E7EB] rounded-lg overflow-hidden">
              <div class="px-4 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <p class="text-sm font-semibold text-[#1A1A1B]">Задачи</p>
              </div>
              <div class="divide-y divide-[#F3F4F6]">
                @for (t of team.tasks; track t.id) {
                  <div class="px-4 py-3">
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <span class="text-sm font-mono font-medium text-[#1A1A1B]">{{ t.code }}</span>
                        <span class="text-xs text-[#6B7280] ml-2">{{ t.title }}</span>
                      </div>
                      <span class="text-xs font-medium px-2.5 py-1 rounded-full" [class]="taskStatusClass(t.status)">
                        {{ taskStatusLabel(t.status) }}
                      </span>
                    </div>
                    @if (t.status !== 'Accepted') {
                      <div class="flex items-center gap-2 mt-2">
                        <input type="number" min="1" max="10" placeholder="Оценка (1–10)"
                          [(ngModel)]="taskScores[t.id]"
                          class="h-8 w-32 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition" />
                        <button (click)="markReady(t.id)"
                          class="h-8 px-3 rounded-lg border border-[#E5E7EB] text-xs text-[#6B7280] font-medium hover:border-[#005BFF] hover:text-[#005BFF] transition-colors">
                          Готовы сдать
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      } @else if (!teamLoading) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <p class="text-sm text-[#9CA3AF]">Команда не найдена — возможно, вы ещё не распределены.</p>
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
  team: MyTeamDto | null = null;
  teamLoading = true;
  taskScores: Record<string, number | null> = {};
  miniTest: MiniTestDto | null = null;
  answers: Record<string, number> = {};
  testSubmitted = false;
  secondsLeft = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sub?: Subscription;

  ngOnInit() {
    this.activityId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadMiniTest();
    this.loadTeam();
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
    try {
      this.team = await this.api.myTeam(this.activityId);
      this.team.tasks.forEach(t => { if (!(t.id in this.taskScores)) this.taskScores[t.id] = null; });
    } catch {
      this.team = null;
    } finally {
      this.teamLoading = false;
    }
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
    if (!this.team) return;
    try {
      await this.api.requestHelp(this.team.id);
      this.toast.success('Ассистент вызван!');
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async markReady(taskItemId: string) {
    if (!this.team) return;
    const score = this.taskScores[taskItemId];
    if (score === null || score === undefined || score < 1 || score > 10) {
      this.toast.error('Введите оценку от 1 до 10');
      return;
    }
    try {
      await this.api.markTeamTaskReady(this.team.id, taskItemId);
      this.toast.success('Ассистент уведомлён о готовности');
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  taskStatusLabel(status: string) {
    const map: Record<string, string> = {
      Accepted: 'Принято', InReview: 'На проверке', Rejected: 'Не принято', NotStarted: 'Не начато',
      ReadyForReview: 'Ожидает приёма'
    };
    return map[status] ?? status;
  }

  taskStatusClass(status: string) {
    const map: Record<string, string> = {
      Accepted: 'bg-[#D1FAE5] text-[#059669]',
      InReview: 'bg-[#EAF2FF] text-[#005BFF]',
      Rejected: 'bg-[#FEE2E2] text-[#DC2626]',
      ReadyForReview: 'bg-[#FEF3C7] text-[#D97706]',
    };
    return map[status] ?? 'bg-[#F3F4F6] text-[#6B7280]';
  }
}
