import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SignalRService } from '../../core/signalr.service';
import { ToastService } from '../../core/toast.service';
import { KtSlot } from '../../core/models';
import { Subscription } from 'rxjs';

interface TaskState {
  taskItemId: string;
  taskCode: string;
  status: string;
  queuePosition: number;
  solutionUrl: string;
  savedUrl: string;
  urlDirty: boolean;
  savingUrl: boolean;
  toggling: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  Draft: 'Не начато',
  ReadyForReview: 'В очереди',
  InReview: 'Вас вызвали!',
  Accepted: 'Принято',
  Rejected: 'Не принято',
};

const STATUS_CLASS: Record<string, string> = {
  Draft: 'bg-[#F3F4F6] text-[#6B7280]',
  ReadyForReview: 'bg-[#FEF3C7] text-[#D97706]',
  InReview: 'bg-[#EAF2FF] text-[#005BFF] font-semibold animate-pulse',
  Accepted: 'bg-[#D1FAE5] text-[#059669]',
  Rejected: 'bg-[#FEE2E2] text-[#DC2626]',
};

@Component({
  selector: 'app-kt-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5 max-w-2xl">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">Контрольная точка</h1>

      <div class="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] p-4">
        <p class="text-xs text-[#4B72B0] leading-relaxed">
          Отметьте задачи флажком, когда готовы сдавать — вас добавят в очередь.
          Укажите ссылку на решение (Google Drive) и нажмите «Сохранить».
        </p>
      </div>

      @if (tasks.length === 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p class="text-sm text-[#9CA3AF]">Нет задач. Преподаватель ещё не начал КТ или вы не записаны на этот курс.</p>
        </div>
      }

      <div class="space-y-3">
        @for (task of tasks; track task.taskItemId) {
          <div class="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
            <!-- Header row -->
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <!-- Checkbox toggle -->
                <button
                  (click)="canToggle(task.status) && !task.toggling && toggleQueue(task)"
                  [disabled]="!canToggle(task.status) || task.toggling"
                  [class]="checkboxClass(task.status)"
                  [title]="task.status === 'ReadyForReview' ? 'Выйти из очереди' : 'Встать в очередь'">
                  @if (isChecked(task.status)) {
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                </button>
                <div>
                  <span class="font-mono font-semibold text-sm text-[#1A1A1B]">{{ task.taskCode }}</span>
                  @if (task.status === 'ReadyForReview' && task.queuePosition > 0) {
                    <span class="text-xs text-[#6B7280] ml-2">позиция: {{ task.queuePosition }}</span>
                  }
                </div>
              </div>
              <span class="text-xs font-medium px-2.5 py-1 rounded-full" [class]="STATUS_CLASS[task.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'">
                {{ STATUS_LABEL[task.status] ?? task.status }}
              </span>
            </div>

            <!-- Solution URL row -->
            @if (task.status !== 'Accepted' && task.status !== 'Rejected') {
              <div class="flex gap-2">
                <input type="url"
                  placeholder="Ссылка на решение (Google Drive)"
                  [value]="task.solutionUrl"
                  (input)="onUrlChange(task, $any($event.target).value)"
                  class="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition" />
                <button (click)="saveSolution(task)"
                  [disabled]="!task.urlDirty || task.savingUrl || !task.solutionUrl.trim()"
                  class="h-9 px-4 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] disabled:opacity-50 transition-colors">
                  {{ task.savingUrl ? '...' : 'Сохранить' }}
                </button>
              </div>
            }

            <!-- Show saved URL for finished tasks -->
            @if ((task.status === 'Accepted' || task.status === 'Rejected') && task.savedUrl) {
              <a [href]="task.savedUrl" target="_blank" rel="noopener noreferrer"
                class="flex items-center gap-1.5 text-xs text-[#005BFF] hover:underline">
                🔗 Моё решение
              </a>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class KtDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private signalr = inject(SignalRService);
  private toast = inject(ToastService);

  activityId = '';
  tasks: TaskState[] = [];
  readonly STATUS_LABEL = STATUS_LABEL;
  readonly STATUS_CLASS = STATUS_CLASS;
  private sub?: Subscription;

  ngOnInit() {
    this.activityId = this.route.snapshot.paramMap.get('id') ?? '';
    this.reload();
    this.sub = this.signalr.notification$.subscribe(payload => {
      if (payload.type === 'KtCalled') {
        this.toast.success(payload.title);
        this.reload();
      }
      if (payload.type === 'KtAccepted') { this.toast.success(payload.title); this.reload(); }
      if (payload.type === 'KtRejected') { this.toast.error(payload.title); this.reload(); }
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  async reload() {
    const slots = await this.api.ktAllTasks(this.activityId).catch(() => [] as KtSlot[]);
    const map = new Map(this.tasks.map(t => [t.taskItemId, t]));
    this.tasks = slots.map(s => {
      const existing = map.get(s.taskItemId);
      const serverUrl = s.solutionUrl ?? '';
      return {
        taskItemId: s.taskItemId,
        taskCode: s.taskCode,
        status: s.status,
        queuePosition: s.queuePosition,
        solutionUrl: existing?.urlDirty ? existing.solutionUrl : serverUrl,
        savedUrl: serverUrl,
        urlDirty: existing?.urlDirty ?? false,
        savingUrl: existing?.savingUrl ?? false,
        toggling: false,
      };
    });
  }

  canToggle(status: string) { return status === 'Draft' || status === 'ReadyForReview'; }
  isChecked(status: string) { return status === 'ReadyForReview' || status === 'InReview' || status === 'Accepted'; }

  checkboxClass(status: string) {
    const checked = this.isChecked(status);
    const cantToggle = !this.canToggle(status);
    return `w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
      ${checked ? 'bg-[#005BFF] border-[#005BFF]' : 'border-[#D1D5DB] hover:border-[#005BFF]'}
      ${cantToggle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;
  }

  onUrlChange(task: TaskState, val: string) {
    task.solutionUrl = val;
    task.urlDirty = val !== task.savedUrl;
  }

  async toggleQueue(task: TaskState) {
    task.toggling = true;
    try {
      if (task.status === 'ReadyForReview') {
        await this.api.ktUnmarkReady(this.activityId, task.taskItemId);
        this.toast.info('Вы вышли из очереди по задаче ' + task.taskCode);
      } else {
        await this.api.ktMarkReady(this.activityId, task.taskItemId);
        this.toast.success('Задача ' + task.taskCode + ' — ждите вызова!');
      }
      await this.reload();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      task.toggling = false;
    }
  }

  async saveSolution(task: TaskState) {
    if (!task.solutionUrl.trim()) return;
    task.savingUrl = true;
    try {
      await this.api.ktSetSolution(this.activityId, task.taskItemId, task.solutionUrl.trim());
      task.savedUrl = task.solutionUrl.trim();
      task.urlDirty = false;
      task.savingUrl = false;
      this.toast.success('Ссылка сохранена');
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
      task.savingUrl = false;
    }
  }
}
