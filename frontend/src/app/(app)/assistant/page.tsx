"use client";
import { useEffect, useState } from "react";
import { studentApi, StudentActivity, assistantApps, assistantStats, AssistantSession } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { BookOpen, ClipboardCheck, ChevronRight, Award } from "lucide-react";

interface AppState {
  activityId: string;
  message: string;
  submitting: boolean;
  done: boolean;
}

// Group sessions by course → module
interface ModuleStat {
  moduleNumber: number;
  moduleTitle: string;
  courseCode: string;
  courseTitle: string;
  count: number;
  sessions: AssistantSession[];
}

export default function AssistantIndexPage() {
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [appStates, setAppStates] = useState<Record<string, AppState>>({});
  const [moduleStats, setModuleStats] = useState<ModuleStat[]>([]);

  useEffect(() => {
    studentApi.myActivities().then(acts => {
      setActivities(acts);
      const initial: Record<string, AppState> = {};
      acts.forEach(a => {
        initial[a.id] = { activityId: a.id, message: "", submitting: false, done: false };
      });
      setAppStates(initial);
    }).catch(() => {});

    assistantStats.mySessions().then(sessions => {
      // Group by moduleId
      const map = new Map<string, ModuleStat>();
      for (const s of sessions) {
        const key = s.moduleId;
        if (!map.has(key)) {
          map.set(key, {
            moduleNumber: s.moduleNumber,
            moduleTitle: s.moduleTitle,
            courseCode: s.courseCode,
            courseTitle: s.courseTitle,
            count: 0,
            sessions: [],
          });
        }
        const entry = map.get(key)!;
        entry.count++;
        entry.sessions.push(s);
      }
      setModuleStats(Array.from(map.values()).sort((a, b) =>
        a.courseCode.localeCompare(b.courseCode) || a.moduleNumber - b.moduleNumber
      ));
    }).catch(() => {});
  }, []);

  async function apply(activityId: string) {
    const state = appStates[activityId];
    if (!state) return;
    setAppStates(prev => ({ ...prev, [activityId]: { ...prev[activityId], submitting: true } }));
    try {
      await assistantApps.apply(activityId, state.message || undefined);
      toast.success("Заявка подана! Ожидайте подтверждения преподавателя.");
      setAppStates(prev => ({ ...prev, [activityId]: { ...prev[activityId], submitting: false, done: true } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      if (msg.includes("Already applied")) {
        toast.info("Вы уже подали заявку на это занятие");
        setAppStates(prev => ({ ...prev, [activityId]: { ...prev[activityId], submitting: false, done: true } }));
      } else {
        toast.error(msg);
        setAppStates(prev => ({ ...prev, [activityId]: { ...prev[activityId], submitting: false } }));
      }
    }
  }

  const upcoming = activities.filter(a => a.status === "Scheduled" || a.status === "Active");

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Панель ассистента</h1>

      {/* Session counter per module */}
      {moduleStats.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
            <Award size={15} className="text-[#005BFF]" />
            <p className="text-sm font-semibold text-[#1A1A1B]">Мои одобренные сессии</p>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {moduleStats.map(stat => (
              <div key={`${stat.courseCode}-${stat.moduleNumber}`} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1A1A1B]">
                    {stat.courseCode} · М{stat.moduleNumber} — {stat.moduleTitle}
                  </p>
                  <p className="text-xs text-[#6B7280]">{stat.courseTitle}</p>
                </div>
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#EAF2FF] flex items-center justify-center text-sm font-bold text-[#005BFF]">
                  {stat.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links to session pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div className="w-9 h-9 rounded-lg bg-[#EAF2FF] flex items-center justify-center mb-3">
            <BookOpen size={18} className="text-[#005BFF]" />
          </div>
          <h2 className="text-sm font-semibold text-[#1A1A1B] mb-1">Лекция / пара</h2>
          <p className="text-xs text-[#6B7280] mb-3">Перейти к активной сессии:</p>
          <div className="space-y-1">
            {activities.filter(a => a.status === "Active" && a.type === 0).map(a => (
              <Link key={a.id} href={`/assistant/session/${a.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#EAF2FF] hover:bg-[#D1E6FF] transition-colors">
                <span className="text-xs font-medium text-[#005BFF] truncate">{a.title}</span>
                <ChevronRight size={12} className="text-[#005BFF] flex-shrink-0" />
              </Link>
            ))}
            {activities.filter(a => a.status === "Active" && a.type === 0).length === 0 && (
              <p className="text-xs text-[#9CA3AF]">Нет активных лекций</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div className="w-9 h-9 rounded-lg bg-[#EAF2FF] flex items-center justify-center mb-3">
            <ClipboardCheck size={18} className="text-[#005BFF]" />
          </div>
          <h2 className="text-sm font-semibold text-[#1A1A1B] mb-1">Контрольная точка</h2>
          <p className="text-xs text-[#6B7280] mb-3">Перейти к активной КТ:</p>
          <div className="space-y-1">
            {activities.filter(a => a.status === "Active" && a.type === 1).map(a => (
              <Link key={a.id} href={`/assistant/kt/${a.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#EAF2FF] hover:bg-[#D1E6FF] transition-colors">
                <span className="text-xs font-medium text-[#005BFF] truncate">{a.title}</span>
                <ChevronRight size={12} className="text-[#005BFF] flex-shrink-0" />
              </Link>
            ))}
            {activities.filter(a => a.status === "Active" && a.type === 1).length === 0 && (
              <p className="text-xs text-[#9CA3AF]">Нет активных КТ</p>
            )}
          </div>
        </div>
      </div>

      {/* Apply to activities */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Подать заявку на занятие</p>

        {upcoming.length === 0 && (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 text-center">
            <p className="text-sm text-[#9CA3AF]">Нет предстоящих занятий. Нужно быть записанным на курс.</p>
            <Link href="/courses" className="inline-flex items-center gap-1 mt-2 text-xs text-[#005BFF] hover:underline">
              Перейти к курсам <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {upcoming.map(a => {
          const state = appStates[a.id];
          return (
            <div key={a.id} className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1B]">{a.title}</p>
                  <p className="text-xs text-[#6B7280]">
                    {a.courseCode} · {a.typeLabel} ·{" "}
                    {new Date(a.startsAt).toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {a.status === "Active" && (
                  <span className="text-xs font-medium bg-[#D1FAE5] text-[#059669] px-2.5 py-1 rounded-full">Идёт</span>
                )}
              </div>

              {state && !state.done ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Сообщение для преподавателя (необязательно)"
                    value={state.message}
                    onChange={e => setAppStates(prev => ({ ...prev, [a.id]: { ...prev[a.id], message: e.target.value } }))}
                    className="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"
                  />
                  <button
                    onClick={() => apply(a.id)}
                    disabled={state.submitting}
                    className="h-9 px-4 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] disabled:opacity-60 transition-colors"
                  >
                    {state.submitting ? "..." : "Подать заявку"}
                  </button>
                </div>
              ) : state?.done ? (
                <p className="text-xs text-[#059669] font-medium">✓ Заявка подана — ожидайте подтверждения</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] px-5 py-4">
        <p className="text-xs text-[#4B72B0] leading-relaxed">
          После одобрения заявки преподавателем вы получите уведомление и ссылки на сессию появятся в блоке выше.
        </p>
      </div>
    </div>
  );
}
