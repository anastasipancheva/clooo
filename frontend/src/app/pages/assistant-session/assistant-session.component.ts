import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SignalRService } from '../../core/signalr.service';
import { ToastService } from '../../core/toast.service';
import { HelpRequest, TeamSubmission } from '../../core/models';
import { Subscription } from 'rxjs';

const STATUS_LABEL: Record<string, string> = {
  ReadyForReview: 'Ожидает', InReview: 'На проверке', Accepted: 'Принято', Rejected: 'Не принято',
};
const STATUS_STYLE: Record<string, string> = {
  ReadyForReview: 'bg-[#FEF3C7] text-[#D97706]',
  InReview: 'bg-[#EAF2FF] text-[#005BFF]',
  Accepted: 'bg-[#D1FAE5] text-[#059669]',
  Rejected: 'bg-[#FEE2E2] text-[#DC2626]',
};

@Component({
  selector: 'app-assistant-session',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">Панель ассистента</h1>

      <!-- Help requests -->
      <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div class="px-5 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <span class="text-sm font-semibold text-[#1A1A1B]">Вызовы ассистента</span>
          @if (helpRequests.length > 0) {
            <span class="h-5 min-w-5 px-1.5 rounded-full bg-[#DC2626] text-white text-xs font-bold flex items-center justify-center">
              {{ helpRequests.length }}
            </span>
          }
        </div>
        <div class="divide-y divide-[#F3F4F6]">
          @if (helpRequests.length === 0) {
            <p class="px-5 py-4 text-sm text-[#9CA3AF]">Нет вызовов</p>
          }
          @for (hr of helpRequests; track hr.id) {
            <div class="flex items-start justify-between gap-3 px-5 py-3">
              <div>
                <p class="text-sm font-medium text-[#1A1A1B]">{{ hr.teamName }}</p>
                @if (hr.message) { <p class="text-xs text-[#6B7280] mt-0.5">{{ hr.message }}</p> }
                <p class="text-xs text-[#9CA3AF] mt-0.5">{{ hr.createdAt | date:'shortTime' }}</p>
              </div>
              <button (click)="resolveHelp(hr.id)"
                class="h-8 px-3 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] font-medium hover:border-[#005BFF] hover:text-[#005BFF] transition-colors shrink-0">
                Закрыть
              </button>
            </div>
          }
        </div>
      </div>

      <!-- Submission queue -->
      <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div class="px-5 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <span class="text-sm font-semibold text-[#1A1A1B]">Очередь сдач</span>
          @if (submissions.length > 0) {
            <span class="h-5 min-w-5 px-1.5 rounded-full bg-[#EAF2FF] text-[#005BFF] text-xs font-bold flex items-center justify-center">
              {{ submissions.length }}
            </span>
          }
        </div>
        <div class="divide-y divide-[#F3F4F6]">
          @if (submissions.length === 0) {
            <p class="px-5 py-4 text-sm text-[#9CA3AF]">Очередь пуста</p>
          }
          @for (sub of submissions; track sub.submissionId) {
            <div class="flex items-center justify-between gap-3 px-5 py-3">
              <div class="min-w-0">
                <span class="text-sm font-medium text-[#1A1A1B]">{{ sub.teamName }}</span>
                <span class="text-xs text-[#6B7280] ml-2 font-mono">задача {{ sub.taskCode }}</span>
                @if (sub.readyAt) {
                  <span class="text-xs text-[#9CA3AF] ml-2">с {{ sub.readyAt | date:'shortTime' }}</span>
                }
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-xs font-medium px-2 py-0.5 rounded-full" [class]="statusStyle(sub.status)">
                  {{ statusLabel(sub.status) }}
                </span>
                @if (sub.status === 'ReadyForReview') {
                  <button (click)="startReview(sub)"
                    class="h-8 px-3 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] transition-colors">
                    Начать
                  </button>
                }
                @if (sub.status === 'InReview') {
                  <button (click)="completeReview(sub, true)"
                    class="h-8 px-3 rounded-lg bg-[#059669] text-white text-xs font-medium hover:bg-[#047857] transition-colors">
                    Принять
                  </button>
                  <button (click)="completeReview(sub, false)"
                    class="h-8 px-3 rounded-lg bg-[#DC2626] text-white text-xs font-medium hover:bg-[#B91C1C] transition-colors">
                    Не принять
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Group coefficients -->
      @if (uniqueTeamIds.length > 0) {
        <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#E5E7EB]">
            <span class="text-sm font-semibold text-[#1A1A1B]">Групповой коэффициент</span>
            <p class="text-xs text-[#6B7280] mt-0.5">Допустимый диапазон: 0.8 — 1.2</p>
          </div>
          <div class="divide-y divide-[#F3F4F6]">
            @for (teamId of uniqueTeamIds; track teamId) {
              <div class="flex items-center gap-3 px-5 py-3">
                <span class="text-sm text-[#1A1A1B] min-w-28 font-medium">{{ teamName(teamId) }}</span>
                <input type="number" step="0.1" min="0.8" max="1.2"
                  [value]="groupCoeffs[teamId] ?? '1.0'"
                  (input)="groupCoeffs[teamId] = $any($event.target).value"
                  class="h-9 w-24 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition" />
                <button (click)="setGroupScore(teamId)"
                  class="h-9 px-4 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] font-medium hover:border-[#005BFF] hover:text-[#005BFF] transition-colors">
                  Сохранить
                </button>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class AssistantSessionComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private signalr = inject(SignalRService);
  private toast = inject(ToastService);

  activityId = '';
  helpRequests: HelpRequest[] = [];
  submissions: TeamSubmission[] = [];
  groupCoeffs: Record<string, string> = {};
  private sub?: Subscription;

  get uniqueTeamIds() { return [...new Set(this.submissions.map(s => s.teamId))]; }

  ngOnInit() {
    this.activityId = this.route.snapshot.paramMap.get('id') ?? '';
    this.reload();
    this.sub = this.signalr.notification$.subscribe(payload => {
      const types = ['TeamHelpRequested', 'TeamReadyToDefend', 'ReviewStarted', 'TaskAccepted', 'TaskRejected'];
      if (types.includes(payload.type)) {
        this.toast.info(payload.title);
        this.reload();
      }
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  async reload() {
    const [hr, subs] = await Promise.all([
      this.api.openHelp(this.activityId).catch(() => [] as HelpRequest[]),
      this.api.pendingSubmissions(this.activityId).catch(() => [] as TeamSubmission[]),
    ]);
    this.helpRequests = hr;
    this.submissions = subs;
  }

  async resolveHelp(id: string) {
    await this.api.resolveHelp(id);
    this.reload();
  }

  async startReview(sub: TeamSubmission) {
    const defender = prompt(`Введите userId защитника (из команды ${sub.teamName}):`);
    if (!defender) return;
    try {
      await this.api.startReview(sub.submissionId, defender);
      this.toast.success('Приём начат');
      this.reload();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async completeReview(sub: TeamSubmission, accepted: boolean) {
    try {
      await this.api.completeReview(sub.submissionId, accepted, accepted ? 1 : 0);
      accepted ? this.toast.success('Принято') : this.toast.error('Не принято');
      this.reload();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async setGroupScore(teamId: string) {
    const coeff = parseFloat(this.groupCoeffs[teamId] ?? '1');
    if (isNaN(coeff) || coeff < 0.8 || coeff > 1.2) {
      this.toast.error('Коэффициент должен быть от 0.8 до 1.2');
      return;
    }
    try {
      await this.api.setGroupScore(this.activityId, teamId, coeff);
      this.toast.success('Коэффициент выставлен');
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  teamName(teamId: string) { return this.submissions.find(s => s.teamId === teamId)?.teamName ?? teamId; }
  statusLabel(s: string) { return STATUS_LABEL[s] ?? s; }
  statusStyle(s: string) { return STATUS_STYLE[s] ?? 'bg-[#F3F4F6] text-[#6B7280]'; }
}
