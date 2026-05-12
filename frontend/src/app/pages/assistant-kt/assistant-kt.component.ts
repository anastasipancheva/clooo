import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SignalRService } from '../../core/signalr.service';
import { ToastService } from '../../core/toast.service';
import { KtQueueEntry } from '../../core/models';
import { Subscription } from 'rxjs';

const STATUS_STYLE: Record<string, string> = {
  ReadyForReview: 'bg-[#FEF3C7] text-[#D97706]',
  InReview: 'bg-[#EAF2FF] text-[#005BFF]',
  Accepted: 'bg-[#D1FAE5] text-[#059669]',
  Rejected: 'bg-[#FEE2E2] text-[#DC2626]',
};

@Component({
  selector: 'app-assistant-kt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">КТ — панель ассистента</h1>

      <!-- Task selector -->
      <div class="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <p class="text-sm font-semibold text-[#1A1A1B] mb-3">Задача</p>
        <div class="flex gap-2 items-center flex-wrap">
          <input
            class="h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition flex-1 max-w-xs"
            placeholder="Task Item ID (UUID)"
            [(ngModel)]="taskItemId" />
          <button (click)="reload()"
            class="h-10 px-4 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] font-medium hover:border-[#005BFF] hover:text-[#005BFF] transition-colors">
            Загрузить очередь
          </button>
          <button (click)="callNext()" [disabled]="!taskItemId"
            class="h-10 px-5 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Вызвать следующего
          </button>
        </div>
      </div>

      <!-- Queue -->
      <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div class="px-5 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <span class="text-sm font-semibold text-[#1A1A1B]">Очередь</span>
          @if (queue.length > 0) {
            <span class="h-5 min-w-5 px-1.5 rounded-full bg-[#EAF2FF] text-[#005BFF] text-xs font-bold flex items-center justify-center">
              {{ queue.length }}
            </span>
          }
        </div>
        <div class="divide-y divide-[#F3F4F6]">
          @if (queue.length === 0) {
            <p class="px-5 py-4 text-sm text-[#9CA3AF]">Очередь пуста</p>
          }
          @for (entry of queue; track entry.submissionId; let i = $index) {
            <div class="flex items-center justify-between px-5 py-3">
              <div>
                <span class="text-sm font-medium text-[#9CA3AF] mr-2">#{{ i + 1 }}</span>
                <span class="text-sm font-medium text-[#1A1A1B]">{{ entry.studentEmail }}</span>
                @if (entry.readyAt) {
                  <span class="text-xs text-[#9CA3AF] ml-2">с {{ entry.readyAt | date:'shortTime' }}</span>
                }
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium px-2.5 py-1 rounded-full" [class]="statusStyle(entry.status)">
                  {{ entry.status }}
                </span>
                @if (entry.status === 'InReview') {
                  <button (click)="complete(entry.submissionId, true)"
                    class="h-8 px-3 rounded-lg bg-[#059669] text-white text-xs font-medium hover:bg-[#047857] transition-colors">
                    Принять
                  </button>
                  <button (click)="complete(entry.submissionId, false)"
                    class="h-8 px-3 rounded-lg bg-[#DC2626] text-white text-xs font-medium hover:bg-[#B91C1C] transition-colors">
                    Не принять
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class AssistantKtComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private signalr = inject(SignalRService);
  private toast = inject(ToastService);

  activityId = '';
  taskItemId = '';
  queue: KtQueueEntry[] = [];
  private sub?: Subscription;

  ngOnInit() {
    this.activityId = this.route.snapshot.paramMap.get('id') ?? '';
    this.sub = this.signalr.notification$.subscribe(payload => {
      if (payload.type === 'KtTaskReady') { this.toast.info(payload.title); this.reload(); }
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  async reload() {
    if (!this.taskItemId) return;
    this.queue = await this.api.ktQueue(this.activityId, this.taskItemId).catch(() => [] as KtQueueEntry[]);
  }

  async callNext() {
    try {
      await this.api.ktCallNext(this.activityId, this.taskItemId);
      this.toast.success('Студент вызван');
      this.reload();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async complete(submissionId: string, accepted: boolean) {
    try {
      await this.api.ktCompleteReview(this.activityId, submissionId, accepted, accepted ? 1 : 0);
      accepted ? this.toast.success('Принято') : this.toast.error('Не принято');
      this.reload();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  statusStyle(s: string) { return STATUS_STYLE[s] ?? 'bg-[#F3F4F6] text-[#6B7280]'; }
}
