"use client";
import { useEffect, useState } from "react";
import { courses, student, Course, StudentScore } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { UserPlus, UserMinus } from "lucide-react";

export default function ScoresPage() {
  const { user } = useAuth();
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState<StudentScore | null>(null);

  useEffect(() => {
    courses.list().then(setCourseList).catch(() => {});
    student.enrolledCourses().then((list) =>
      setEnrolledIds(new Set(list.map((c) => c.id)))
    ).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected || !user) return;
    courses.studentScore(selected, user.id)
      .then(setScore)
      .catch(() => setScore(null));
  }, [selected, user]);

  async function handleEnroll(courseId: string) {
    try {
      await student.enroll(courseId);
      setEnrolledIds((prev) => new Set([...prev, courseId]));
      toast.success("Вы записались на курс");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function handleUnenroll(courseId: string) {
    try {
      await student.unenroll(courseId);
      setEnrolledIds((prev) => { const s = new Set(prev); s.delete(courseId); return s; });
      if (selected === courseId) setSelected(null);
      toast.success("Вы отписались от курса");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const byModule = (n: number) => score?.modules.find((m) => m.moduleNumber === n)?.moduleScore ?? null;

  const markColor = (mark: string) => {
    if (mark.startsWith("5")) return "text-[#059669] bg-[#D1FAE5]";
    if (mark.startsWith("4")) return "text-[#005BFF] bg-[#EAF2FF]";
    if (mark.startsWith("3")) return "text-[#D97706] bg-[#FEF3C7]";
    return "text-[#DC2626] bg-[#FEE2E2]";
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Мои баллы</h1>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
        <p className="text-xs font-medium text-[#6B7280] mb-3 uppercase tracking-wide">Доступные курсы</p>
        <div className="space-y-2">
          {courseList.length === 0 && (
            <p className="text-sm text-[#9CA3AF]">Нет доступных курсов</p>
          )}
          {courseList.map((c) => {
            const enrolled = enrolledIds.has(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                <button
                  onClick={() => enrolled && setSelected(c.id === selected ? null : c.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selected === c.id
                      ? "bg-[#005BFF] text-white border-[#005BFF]"
                      : enrolled
                      ? "bg-white text-[#1A1A1B] border-[#E5E7EB] hover:border-[#005BFF]/40"
                      : "bg-[#F9FAFB] text-[#9CA3AF] border-[#E5E7EB] cursor-default"
                  }`}
                >
                  {c.code} — {c.title}
                  {enrolled && <span className="ml-2 text-xs opacity-60">({c.academicYear})</span>}
                </button>
                {enrolled ? (
                  <button
                    onClick={() => handleUnenroll(c.id)}
                    className="flex items-center gap-1 text-xs text-[#DC2626] hover:text-[#B91C1C] transition-colors"
                  >
                    <UserMinus size={13} />
                    Отписаться
                  </button>
                ) : (
                  <button
                    onClick={() => handleEnroll(c.id)}
                    className="flex items-center gap-1 text-xs text-[#005BFF] hover:text-[#0050E6] transition-colors font-medium"
                  >
                    <UserPlus size={13} />
                    Записаться
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && !score && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center text-sm text-[#9CA3AF]">
          Нет данных по баллам
        </div>
      )}

      {selected && score && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1A1A1B]">{score.displayName}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#6B7280]">
                Итог: <span className="font-semibold text-[#1A1A1B]">{score.finalScore.toFixed(1)}</span>
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${markColor(score.mark)}`}>
                {score.mark}
              </span>
            </div>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {[1, 2, 3].map((n) => {
              const val = byModule(n);
              return (
                <div key={n} className="px-5 py-3.5 flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">Модуль {n}</span>
                  <span className="text-sm font-semibold text-[#1A1A1B]">
                    {val !== null ? val.toFixed(1) : <span className="text-[#9CA3AF] font-normal">—</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
