"use client";
import { useEffect, useState } from "react";
import { courses, teaching, admin, Course, StudentScore, CourseFull, CourseModule, CourseActivity, CourseTaskSet } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { PlusCircle, ChevronRight, ChevronDown } from "lucide-react";

const ACTIVITY_TYPES = [
  { value: 1, label: "Лекция" },
  { value: 2, label: "КТ" },
  { value: 3, label: "Занятие с ДЗ" },
];

const ROLES = ["Student", "Assistant", "Teacher", "Admin"];

const inputCls = "h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition";
const btnCls = "h-9 px-4 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] transition-colors flex items-center gap-1.5 whitespace-nowrap";
const sectionCls = "bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4";

export default function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  // Course list + create
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newYear, setNewYear] = useState("2024/2025");

  // Teaching setup hierarchy
  const [setupCourseId, setSetupCourseId] = useState<string | null>(null);
  const [courseFull, setCourseFull] = useState<CourseFull | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [expandedTaskSetId, setExpandedTaskSetId] = useState<string | null>(null);

  // Module form
  const [modNum, setModNum] = useState("1");
  const [modTitle, setModTitle] = useState("");
  const [modStart, setModStart] = useState("");
  const [modEnd, setModEnd] = useState("");

  // Activity form
  const [actType, setActType] = useState("1");
  const [actTitle, setActTitle] = useState("");
  const [actStart, setActStart] = useState("");
  const [actEnd, setActEnd] = useState("");

  // Task set form
  const [tsTitle, setTsTitle] = useState("");

  // Task form
  const [taskCode, setTaskCode] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPoints, setTaskPoints] = useState("1");

  // Score table
  const [scoresCourseId, setScoresCourseId] = useState<string | null>(null);
  const [allScores, setAllScores] = useState<StudentScore[]>([]);

  // User management (admin only)
  const [userList, setUserList] = useState<{ id: string; email: string; displayName: string; role: string }[]>([]);
  const [roleChanges, setRoleChanges] = useState<Record<string, string>>({});

  useEffect(() => {
    courses.list().then(setCourseList).catch(() => {});
  }, []);

  useEffect(() => {
    if (!scoresCourseId) return;
    courses.scores(scoresCourseId).then(setAllScores).catch(() => setAllScores([]));
  }, [scoresCourseId]);

  useEffect(() => {
    if (!setupCourseId) { setCourseFull(null); return; }
    teaching.getCourseFull(setupCourseId).then(setCourseFull).catch(() => {});
  }, [setupCourseId]);

  useEffect(() => {
    if (isAdmin) admin.listUsers().then(setUserList).catch(() => {});
  }, [isAdmin]);

  function reloadCourseFull() {
    if (!setupCourseId) return;
    teaching.getCourseFull(setupCourseId).then(setCourseFull).catch(() => {});
  }

  async function createCourse() {
    if (!newCode || !newTitle) { toast.error("Заполните код и название"); return; }
    try {
      await teaching.createCourse(newCode, newTitle, newYear);
      toast.success("Курс создан");
      courses.list().then(setCourseList).catch(() => {});
      setNewCode(""); setNewTitle("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addModule() {
    if (!setupCourseId || !modTitle || !modStart || !modEnd) {
      toast.error("Заполните все поля модуля"); return;
    }
    try {
      await teaching.addModule(setupCourseId, parseInt(modNum), modTitle, modStart, modEnd);
      toast.success("Модуль добавлен");
      setModTitle(""); reloadCourseFull();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addActivity() {
    if (!selectedModuleId || !actTitle || !actStart || !actEnd) {
      toast.error("Заполните все поля занятия"); return;
    }
    try {
      await teaching.addActivity(selectedModuleId, parseInt(actType), actTitle, actStart, actEnd);
      toast.success("Занятие добавлено");
      setActTitle(""); reloadCourseFull();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addTaskSet() {
    if (!selectedActivityId || !tsTitle) {
      toast.error("Введите название набора задач"); return;
    }
    try {
      await teaching.addTaskSet(selectedActivityId, tsTitle);
      toast.success("Набор задач добавлен");
      setTsTitle(""); reloadCourseFull();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addTask(taskSetId: string) {
    if (!taskCode || !taskTitle || !taskPoints) {
      toast.error("Заполните код, название и баллы"); return;
    }
    try {
      await teaching.addTask(taskSetId, taskCode, taskTitle, null, parseFloat(taskPoints));
      toast.success("Задание добавлено");
      setTaskCode(""); setTaskTitle(""); setTaskPoints("1");
      reloadCourseFull();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function saveRole(userId: string) {
    const roleName = roleChanges[userId];
    if (!roleName) return;
    try {
      await admin.setRole(userId, roleName);
      toast.success("Роль обновлена");
      admin.listUsers().then(setUserList).catch(() => {});
      setRoleChanges((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  const selectedModule: CourseModule | undefined = courseFull?.modules.find((m) => m.id === selectedModuleId);
  const selectedActivity: CourseActivity | undefined = selectedModule?.activities.find((a) => a.id === selectedActivityId);

  const markColor = (mark: string) => {
    if (mark.startsWith("5")) return "text-[#059669] bg-[#D1FAE5]";
    if (mark.startsWith("4")) return "text-[#005BFF] bg-[#EAF2FF]";
    if (mark.startsWith("3")) return "text-[#D97706] bg-[#FEF3C7]";
    return "text-[#DC2626] bg-[#FEE2E2]";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Управление</h1>

      {/* ── Create course ── */}
      <div className={sectionCls}>
        <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Создать курс</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-[#6B7280] mb-1">Код</label>
            <input className={`${inputCls} w-24`} value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="MKN2" />
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] mb-1">Название</label>
            <input className={`${inputCls} w-56`} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Математика для КН ч.2" />
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] mb-1">Учебный год</label>
            <input className={`${inputCls} w-28`} value={newYear} onChange={(e) => setNewYear(e.target.value)} />
          </div>
          <button onClick={createCourse} className={btnCls}>
            <PlusCircle size={15} /> Создать
          </button>
        </div>
      </div>

      {/* ── Teaching setup ── */}
      {courseList.length > 0 && (
        <div className={sectionCls}>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Настройка курса</p>

          {/* Course select */}
          <div>
            <label className="block text-xs text-[#6B7280] mb-1.5">Курс</label>
            <div className="flex flex-wrap gap-2">
              {courseList.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSetupCourseId(c.id === setupCourseId ? null : c.id); setSelectedModuleId(null); setSelectedActivityId(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    setupCourseId === c.id ? "bg-[#005BFF] text-white border-[#005BFF]" : "bg-white text-[#1A1A1B] border-[#E5E7EB] hover:border-[#005BFF]/40"
                  }`}
                >
                  {c.code} — {c.title}
                </button>
              ))}
            </div>
          </div>

          {/* Modules */}
          {courseFull && (
            <div className="border border-[#E5E7EB] rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-[#1A1A1B] uppercase tracking-wide">Модули</p>

              {/* Existing modules */}
              {courseFull.modules.map((m) => (
                <div key={m.id} className="space-y-2">
                  <button
                    onClick={() => { setSelectedModuleId(m.id === selectedModuleId ? null : m.id); setSelectedActivityId(null); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                      selectedModuleId === m.id ? "bg-[#EAF2FF] border-[#005BFF]/30 text-[#005BFF]" : "bg-[#F9FAFB] border-[#E5E7EB] text-[#1A1A1B] hover:border-[#005BFF]/30"
                    }`}
                  >
                    <span className="font-medium">М{m.number}: {m.title}</span>
                    {selectedModuleId === m.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {/* Activities for this module */}
                  {selectedModuleId === m.id && (
                    <div className="ml-4 space-y-2">
                      {m.activities.map((a) => (
                        <div key={a.id} className="space-y-2">
                          <button
                            onClick={() => setSelectedActivityId(a.id === selectedActivityId ? null : a.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                              selectedActivityId === a.id ? "bg-[#EAF2FF] border-[#005BFF]/30 text-[#005BFF]" : "bg-[#F9FAFB] border-[#E5E7EB] text-[#1A1A1B] hover:border-[#005BFF]/30"
                            }`}
                          >
                            <span>{ACTIVITY_TYPES.find((t) => t.value === a.type)?.label}: {a.title}</span>
                            {selectedActivityId === a.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          {/* Task sets for this activity */}
                          {selectedActivityId === a.id && (
                            <div className="ml-4 space-y-2">
                              {a.taskSets.map((ts: CourseTaskSet) => (
                                <div key={ts.id} className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => setExpandedTaskSetId(ts.id === expandedTaskSetId ? null : ts.id)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-[#F9FAFB] text-sm text-[#1A1A1B] hover:bg-[#F3F4F6] transition-colors"
                                  >
                                    <span className="font-medium">{ts.title}</span>
                                    {expandedTaskSetId === ts.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                  </button>

                                  {expandedTaskSetId === ts.id && (
                                    <div className="p-3 space-y-2">
                                      {ts.tasks.length > 0 && (
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="text-[#6B7280]">
                                              <th className="text-left pb-1">Код</th>
                                              <th className="text-left pb-1">Название</th>
                                              <th className="text-right pb-1">Баллы</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[#F3F4F6]">
                                            {ts.tasks.map((t) => (
                                              <tr key={t.id}>
                                                <td className="py-1 font-mono text-[#005BFF]">{t.code}</td>
                                                <td className="py-1">{t.title}</td>
                                                <td className="py-1 text-right">{t.points}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                      {/* Add task */}
                                      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#F3F4F6]">
                                        <input className={`${inputCls} w-16`} placeholder="Код" value={taskCode} onChange={(e) => setTaskCode(e.target.value)} />
                                        <input className={`${inputCls} w-40`} placeholder="Название" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                                        <input className={`${inputCls} w-16`} placeholder="Баллы" type="number" min="0" step="0.5" value={taskPoints} onChange={(e) => setTaskPoints(e.target.value)} />
                                        <button onClick={() => addTask(ts.id)} className={btnCls}>
                                          <PlusCircle size={13} /> Задание
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}

                              {/* Add task set */}
                              <div className="flex gap-2">
                                <input className={`${inputCls} flex-1`} placeholder="Название набора задач" value={tsTitle} onChange={(e) => setTsTitle(e.target.value)} />
                                <button onClick={addTaskSet} className={btnCls}>
                                  <PlusCircle size={13} /> Набор задач
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add activity */}
                      <div className="border border-dashed border-[#E5E7EB] rounded-lg p-3 space-y-2">
                        <p className="text-xs text-[#6B7280]">Добавить занятие</p>
                        <div className="flex flex-wrap gap-2">
                          <select className={`${inputCls} w-36`} value={actType} onChange={(e) => setActType(e.target.value)}>
                            {ACTIVITY_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <input className={`${inputCls} w-40`} placeholder="Название" value={actTitle} onChange={(e) => setActTitle(e.target.value)} />
                          <input className={`${inputCls} w-44`} type="datetime-local" value={actStart} onChange={(e) => setActStart(e.target.value)} />
                          <input className={`${inputCls} w-44`} type="datetime-local" value={actEnd} onChange={(e) => setActEnd(e.target.value)} />
                          <button onClick={addActivity} className={btnCls}>
                            <PlusCircle size={13} /> Занятие
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add module */}
              <div className="border border-dashed border-[#E5E7EB] rounded-lg p-3 space-y-2">
                <p className="text-xs text-[#6B7280]">Добавить модуль</p>
                <div className="flex flex-wrap gap-2">
                  <input className={`${inputCls} w-16`} placeholder="№" type="number" min="1" max="3" value={modNum} onChange={(e) => setModNum(e.target.value)} />
                  <input className={`${inputCls} w-40`} placeholder="Название" value={modTitle} onChange={(e) => setModTitle(e.target.value)} />
                  <input className={`${inputCls} w-44`} type="datetime-local" value={modStart} onChange={(e) => setModStart(e.target.value)} />
                  <input className={`${inputCls} w-44`} type="datetime-local" value={modEnd} onChange={(e) => setModEnd(e.target.value)} />
                  <button onClick={addModule} className={btnCls}>
                    <PlusCircle size={15} /> Модуль
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Score table ── */}
      {courseList.length > 0 && (
        <div className={sectionCls}>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Таблица баллов</p>
          <div className="flex flex-wrap gap-2">
            {courseList.map((c) => (
              <button
                key={c.id}
                onClick={() => setScoresCourseId(c.id === scoresCourseId ? null : c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  scoresCourseId === c.id ? "bg-[#005BFF] text-white border-[#005BFF]" : "bg-white text-[#1A1A1B] border-[#E5E7EB] hover:border-[#005BFF]/40"
                }`}
              >
                {c.code} — {c.title}
              </button>
            ))}
          </div>

          {scoresCourseId && allScores.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Студент</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">М1</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">М2</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">М3</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Итог</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Оценка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {allScores.map((s) => {
                    const byModule = (n: number) => s.modules.find((m) => m.moduleNumber === n)?.moduleScore ?? 0;
                    return (
                      <tr key={s.studentId} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-4 py-3 font-medium text-[#1A1A1B]">{s.displayName}</td>
                        <td className="text-right px-4 py-3 text-[#6B7280]">{byModule(1).toFixed(1)}</td>
                        <td className="text-right px-4 py-3 text-[#6B7280]">{byModule(2).toFixed(1)}</td>
                        <td className="text-right px-4 py-3 text-[#6B7280]">{byModule(3).toFixed(1)}</td>
                        <td className="text-right px-4 py-3 font-semibold text-[#1A1A1B]">{s.finalScore.toFixed(1)}</td>
                        <td className="text-right px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${markColor(s.mark)}`}>{s.mark}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {scoresCourseId && allScores.length === 0 && (
            <p className="text-sm text-[#9CA3AF] text-center py-4">Нет данных</p>
          )}
        </div>
      )}

      {/* ── User management (Admin only) ── */}
      {isAdmin && (
        <div className={sectionCls}>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Управление пользователями</p>
          {userList.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">Нет пользователей</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Пользователь</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Роль</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {userList.map((u) => (
                    <tr key={u.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[#1A1A1B]">{u.displayName}</td>
                      <td className="px-4 py-2.5 text-[#6B7280] text-xs">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <select
                          className="h-7 px-2 rounded border border-[#E5E7EB] text-xs outline-none focus:border-[#005BFF] transition"
                          value={roleChanges[u.id] ?? u.role}
                          onChange={(e) => setRoleChanges((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        {roleChanges[u.id] && roleChanges[u.id] !== u.role && (
                          <button
                            onClick={() => saveRole(u.id)}
                            className="text-xs px-2 py-1 rounded bg-[#005BFF] text-white hover:bg-[#0050E6] transition-colors"
                          >
                            Сохранить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
