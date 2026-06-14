import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SignalRService } from '../../core/signalr.service';
import { ToastService } from '../../core/toast.service';
import { HelpRequest, TeamSubmission, AttendanceTeam } from '../../core/models';
import { Subscription } from 'rxjs';

const STATUS_LABEL: Record<string, string> = {
  ReadyForReview: 'Готовы сдать', InReview: 'На приёме', Accepted: 'Принято', Rejected: 'Не принято',
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
    <div class="space-y-5 max-w-3xl">
      <h1 class="text-lg font-semibold text-[#1A1A1B]">Панель ассистента</h1>

      <!-- Help requests -->
      <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div class="px-5 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <span class="text-sm font-semibold text-[#1A1A1B]">Вызовы ассистента</span>
          @if (helpRequests.length > 0) {
            <span class="h-5 min-w-5 px-1.5 rounded-full bg-[#DC2626] text-white text-xs font-bold flex items-center justify-center">{{ helpRequests.length }}</span>
          }
        </div>
        <div class="divide-y divide-[#F3F4F6]">
          @if (helpRequests.length === 0) { <p class="px-5 py-4 text-sm text-[#9CA3AF]">Нет вызовов</p> }
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
            <span class="h-5 min-w-5 px-1.5 rounded-full bg-[#EAF2FF] text-[#005BFF] text-xs font-bold flex items-center justify-center">{{ submissions.length }}</span>
          }
        </div>
        <div class="divide-y divide-[#F3F4F6]">
          @if (submissions.length === 0) { <p class="px-5 py-4 text-sm text-[#9CA3AF]">Очередь пуста</p> }
          @for (sub of submissions; track sub.submissionId) {
            <div class="px-5 py-3 space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <span class="text-sm font-semibold text-[#1A1A1B]">{{ sub.teamName }}</span>
                  <span class="text-xs text-[#6B7280] ml-2 font-mono">задача {{ sub.taskCode }}</span>
                  <p class="text-xs text-[#6B7280] mt-0.5">
                    Сдаёт: <span class="font-medium text-[#1A1A1B]">{{ sub.defenderName || '—' }}</span>
                    @if (sub.readyAt) { <span class="text-[#9CA3AF]"> · с {{ sub.readyAt | date:'shortTime' }}</span> }
                  </p>
                </div>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" [class]="statusStyle(sub.status)">{{ statusLabel(sub.status) }}</span>
              </div>

              @if (coefFor === sub.submissionId) {
                <!-- Accept: defender coefficient 1.0–1.2 -->
                <div class="flex items-center gap-2 bg-[#F0FDF4] rounded-lg p-2">
                  <label class="text-xs text-[#059669]">Коэф. защитнику (1.0–1.2):</label>
                  <input type="number" step="0.1" min="1" max="1.2" [(ngModel)]="coefValue"
                    class="h-8 w-20 px-2 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#059669]" />
                  <button (click)="confirmAccept(sub)"
                    class="h-8 px-3 rounded-lg bg-[#059669] text-white text-xs font-semibold hover:bg-[#047857] transition-colors">Подтвердить</button>
                  <button (click)="coefFor = null" class="h-8 px-2 rounded-lg text-xs text-[#6B7280]">Отмена</button>
                </div>
              } @else {
                <div class="flex items-center gap-1.5">
                  <button (click)="startAccept(sub)"
                    class="h-8 px-3 rounded-lg bg-[#059669] text-white text-xs font-medium hover:bg-[#047857] transition-colors">
                    Принять задачу
                  </button>
                  <button (click)="reject(sub)"
                    class="h-8 px-3 rounded-lg bg-[#DC2626] text-white text-xs font-medium hover:bg-[#B91C1C] transition-colors">
                    Отклонить задачу
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Attendance (#B13) -->
      <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div class="px-5 py-4 border-b border-[#E5E7EB]">
          <span class="text-sm font-semibold text-[#1A1A1B]">Посещаемость</span>
          <p class="text-xs text-[#6B7280] mt-0.5">Отсутствующим баллы за пару не начисляются. После завершения занятия отметки не меняются.</p>
        </div>
        <div class="divide-y divide-[#F3F4F6]">
          @if (attendance.length === 0) { <p class="px-5 py-4 text-sm text-[#9CA3AF]">Нет команд</p> }
          @for (t of attendance; track t.teamId) {
            <div class="px-5 py-3">
              <p class="text-sm font-medium text-[#1A1A1B] mb-2">{{ t.teamName }}</p>
              <div class="flex flex-wrap gap-2">
                @for (m of t.members; track m.userId) {
                  <button (click)="toggleAttendance(t.teamId, m)"
                    class="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors"
                    [class]="m.isAbsent
                      ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]'
                      : 'bg-[#D1FAE5] text-[#059669] border-[#6EE7B7]'">
                    {{ m.isAbsent ? '✕' : '✓' }} {{ m.displayName }}
                  </button>
                }
                @if (t.members.length === 0) { <span class="text-xs text-[#9CA3AF]">нет участников</span> }
              </div>
            </div>
          }
        </div>
      </div>
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
  attendance: AttendanceTeam[] = [];
  coefFor: string | null = null;
  coefValue = '1.0';
  private sub?: Subscription;

  ngOnInit() {
    this.activityId = this.route.snapshot.paramMap.get('id') ?? '';
    this.reload();
    this.sub = this.signalr.notification$.subscribe(payload => {
      const types = ['TeamHelpRequested', 'TeamReadyToDefend', 'ReviewStarted', 'TaskAccepted', 'TaskRejected'];
      if (types.includes(payload.type)) { this.toast.info(payload.title); this.reload(); }
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  async reload() {
    const [hr, subs, att] = await Promise.all([
      this.api.openHelp(this.activityId).catch(() => [] as HelpRequest[]),
      this.api.pendingSubmissions(this.activityId).catch(() => [] as TeamSubmission[]),
      this.api.attendanceList(this.activityId).catch(() => [] as AttendanceTeam[]),
    ]);
    this.helpRequests = hr;
    this.submissions = subs;
    this.attendance = att;
  }

  async resolveHelp(id: string) { await this.api.resolveHelp(id); this.reload(); }

  startAccept(sub: TeamSubmission) { this.coefFor = sub.submissionId; this.coefValue = '1.0'; }

  async confirmAccept(sub: TeamSubmission) {
    const coef = parseFloat(this.coefValue);
    if (isNaN(coef) || coef < 1 || coef > 1.2) { this.toast.error('Коэффициент должен быть от 1.0 до 1.2'); return; }
    try {
      await this.api.completeReview(sub.submissionId, true, 1, coef);
      this.toast.success('Задача принята');
      this.coefFor = null;
      this.reload();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async reject(sub: TeamSubmission) {
    try {
      await this.api.completeReview(sub.submissionId, false, 0, 1);
      this.toast.info('Задача отклонена — команда может отметить её готовой снова');
      this.reload();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  async toggleAttendance(teamId: string, m: { userId: string; isAbsent: boolean }) {
    const next = !m.isAbsent;
    try {
      await this.api.setAttendance(teamId, m.userId, next);
      m.isAbsent = next;
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  }

  statusLabel(s: string) { return STATUS_LABEL[s] ?? s; }
  statusStyle(s: string) { return STATUS_STYLE[s] ?? 'bg-[#F3F4F6] text-[#6B7280]'; }
}
