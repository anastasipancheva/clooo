"use client";
import { use, useEffect, useState, useCallback } from "react";
import { ktApi, KtSlot } from "@/lib/api";
import { useSignalR } from "@/hooks/useSignalR";
import { toast } from "sonner";
import { Link2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface PageProps { params: Promise<{ id: string }> }

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
  Draft: "Не начато",
  ReadyForReview: "В очереди",
  InReview: "Вас вызвали!",
  Accepted: "Принято",
  Rejected: "Не принято",
};

const STATUS_CLASS: Record<string, string> = {
  Draft: "bg-[#F3F4F6] text-[#6B7280]",
  ReadyForReview: "bg-[#FEF3C7] text-[#D97706]",
  InReview: "bg-[#EAF2FF] text-[#005BFF] font-semibold animate-pulse",
  Accepted: "bg-[#D1FAE5] text-[#059669]",
  Rejected: "bg-[#FEE2E2] text-[#DC2626]",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "Accepted") return <CheckCircle2 size={14} className="text-[#059669]" />;
  if (status === "Rejected") return <XCircle size={14} className="text-[#DC2626]" />;
  if (status === "InReview") return <AlertCircle size={14} className="text-[#005BFF]" />;
  if (status === "ReadyForReview") return <Clock size={14} className="text-[#D97706]" />;
  return null;
}

export default function KtStudentPage({ params }: PageProps) {
  const { id: activityId } = use(params);
  const [tasks, setTasks] = useState<TaskState[]>([]);

  const reload = useCallback(async () => {
    // getAllTasks shows every task for this KT, even before student enters queue
    const slots = await ktApi.getAllTasks(activityId).catch(() => [] as KtSlot[]);
    setTasks(prev => {
      const map = new Map(prev.map(t => [t.taskItemId, t]));
      return slots.map(s => {
        const existing = map.get(s.taskItemId);
        const serverUrl = (s as KtSlot & { solutionUrl?: string }).solutionUrl ?? "";
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
    });
  }, [activityId]);

  useEffect(() => { reload(); }, [reload]);

  useSignalR(useCallback((payload) => {
    if (payload.type === "KtCalled") {
      toast.success(payload.title, { description: "Подойдите к ассистенту!" });
      reload();
    }
    if (payload.type === "KtAccepted" || payload.type === "KtRejected") {
      toast[payload.type === "KtAccepted" ? "success" : "error"](payload.title);
      reload();
    }
  }, [reload]));

  async function toggleQueue(task: TaskState) {
    setTasks(prev => prev.map(t => t.taskItemId === task.taskItemId ? { ...t, toggling: true } : t));
    try {
      if (task.status === "ReadyForReview") {
        await ktApi.unmarkReady(activityId, task.taskItemId);
        toast.info("Вы вышли из очереди по задаче " + task.taskCode);
      } else {
        await ktApi.markReady(activityId, task.taskItemId);
        toast.success("Задача " + task.taskCode + " — ждите вызова!");
      }
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setTasks(prev => prev.map(t => t.taskItemId === task.taskItemId ? { ...t, toggling: false } : t));
    }
  }

  async function saveSolution(task: TaskState) {
    if (!task.solutionUrl.trim()) return;
    setTasks(prev => prev.map(t => t.taskItemId === task.taskItemId ? { ...t, savingUrl: true } : t));
    try {
      await ktApi.setSolution(activityId, task.taskItemId, task.solutionUrl.trim());
      setTasks(prev => prev.map(t =>
        t.taskItemId === task.taskItemId
          ? { ...t, savedUrl: task.solutionUrl.trim(), urlDirty: false, savingUrl: false }
          : t
      ));
      toast.success("Ссылка сохранена");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      setTasks(prev => prev.map(t => t.taskItemId === task.taskItemId ? { ...t, savingUrl: false } : t));
    }
  }

  const canToggle = (status: string) =>
    status === "Draft" || status === "ReadyForReview";

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Контрольная точка</h1>

      <div className="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] p-4">
        <p className="text-xs text-[#4B72B0] leading-relaxed">
          Отметьте задачи флажком, когда готовы сдавать — вас добавят в очередь.
          Укажите ссылку на решение (Google Drive) и нажмите «Сохранить».
        </p>
      </div>

      {tasks.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p className="text-sm text-[#9CA3AF]">Нет задач. Преподаватель ещё не начал КТ или вы не записаны на этот курс.</p>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.taskItemId} className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Checkbox toggle */}
                <button
                  onClick={() => canToggle(task.status) && !task.toggling && toggleQueue(task)}
                  disabled={!canToggle(task.status) || task.toggling}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    task.status === "ReadyForReview" || task.status === "InReview" || task.status === "Accepted"
                      ? "bg-[#005BFF] border-[#005BFF]"
                      : "border-[#D1D5DB] hover:border-[#005BFF]"
                  } ${!canToggle(task.status) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  title={task.status === "ReadyForReview" ? "Выйти из очереди" : "Встать в очередь"}
                >
                  {(task.status === "ReadyForReview" || task.status === "InReview" || task.status === "Accepted") && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div>
                  <span className="font-mono font-semibold text-sm text-[#1A1A1B]">{task.taskCode}</span>
                  {task.status === "ReadyForReview" && task.queuePosition > 0 && (
                    <span className="text-xs text-[#6B7280] ml-2">позиция: {task.queuePosition}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <StatusIcon status={task.status} />
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CLASS[task.status] ?? "bg-[#F3F4F6] text-[#6B7280]"}`}>
                  {STATUS_LABEL[task.status] ?? task.status}
                </span>
              </div>
            </div>

            {/* Solution URL row */}
            {task.status !== "Accepted" && task.status !== "Rejected" && (
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="url"
                    placeholder="Ссылка на решение (Google Drive)"
                    value={task.solutionUrl}
                    onChange={e => setTasks(prev => prev.map(t =>
                      t.taskItemId === task.taskItemId
                        ? { ...t, solutionUrl: e.target.value, urlDirty: e.target.value !== t.savedUrl }
                        : t
                    ))}
                    className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"
                  />
                </div>
                <button
                  onClick={() => saveSolution(task)}
                  disabled={!task.urlDirty || task.savingUrl || !task.solutionUrl.trim()}
                  className="h-9 px-4 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] disabled:opacity-50 transition-colors"
                >
                  {task.savingUrl ? "..." : "Сохранить"}
                </button>
              </div>
            )}

            {/* Show saved URL for finished tasks */}
            {(task.status === "Accepted" || task.status === "Rejected") && task.savedUrl && (
              <a
                href={task.savedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#005BFF] hover:underline"
              >
                <Link2 size={12} /> Моё решение
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
