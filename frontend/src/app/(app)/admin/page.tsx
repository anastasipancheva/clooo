"use client";
import { useEffect, useState } from "react";
import { courses, teaching, admin, Course, StudentScore, CourseFull } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { PlusCircle, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";

const ACTIVITY_TYPES = [
  { value: 1, label: "Лекция" },
  { value: 2, label: "КТ" },
  { value: 3, label: "Занятие с ДЗ" },
];
const ROLES = ["Student", "Assistant", "Teacher", "Admin"];

const inp = "h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition";
const btn = "h-9 px-4 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] transition-colors flex items-center gap-1.5 whitespace-nowrap";
const card = "bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4";

interface LocalItem { id: string; label: string }

export default function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  // Courses
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newYear, setNewYear] = useState("2024/2025");

  // Setup hierarchy selection
  const [setupCourseId, setSetupCourseId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [expandedTsId, setExpandedTsId] = useState<string | null>(null);

  // Remote full-structure (optional — for displaying existing items)
  const [courseFull, setCourseFull] = useState<CourseFull | null>(null);
  const [fullLoading, setFullLoading] = useState(false);

  // Locally created items (survive even if getCourseFull fails)
  const [localModules, setLocalModules] = useState<LocalItem[]>([]);
  const [localActivities, setLocalActivities] = useState<LocalItem[]>([]);
  const [localTaskSets, setLocalTaskSets] = useState<LocalItem[]>([]);

  // Forms — modules
  const [modNum, setModNum] = useState("1");
  const [modTitle, setModTitle] = useState("");
  const [modStart, setModStart] = useState("");
  const [modEnd, setModEnd] = useState("");

  // Forms — activities
  const [actType, setActType] = useState("1");
  const [actTitle, setActTitle] = useState("");
  const [actStart, setActStart] = useState("");
  const [actEnd, setActEnd] = useState("");

  // Forms — task sets / tasks
  const [tsTitle, setTsTitle] = useState("");
  const [taskCode, setTaskCode] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPoints, setTaskPoints] = useState("1");

  // Scores
  const [scoresCourseId, setScoresCourseId] = useState<string | null>(null);
  const [allScores, setAllScores] = useState<StudentScore[]>([]);

  // Users (admin)
  const [userList, setUserList] = useState<{ id: string; email: string; displayName: string; role: string }[]>([]);
  const [roleChanges, setRoleChanges] = useState<Record<string, string>>({});

  // ── Load course list ──
  useEffect(() => { courses.list().then(setCourseList).catch(() => {}); }, []);

  // ── Load full course structure (best-effort) ──
  const loadCourseFull = (id: string) => {
    setFullLoading(true);
    teaching.getCourseFull(id)
      .then(setCourseFull)
      .catch(() => setCourseFull(null))
      .finally(() => setFullLoading(false));
  };

  useEffect(() => {
    if (!setupCourseId) { setCourseFull(null); setLocalModules([]); setLocalActivities([]); setLocalTaskSets([]); return; }
    loadCourseFull(setupCourseId);
  }, [setupCourseId]);

  // ── Scores ──
  useEffect(() => {
    if (!scoresCourseId) return;
    courses.scores(scoresCourseId).then(setAllScores).catch(() => setAllScores([]));
  }, [scoresCourseId]);

  // ── Users (admin) ──
  useEffect(() => {
    if (isAdmin) admin.listUsers().then(setUserList).catch(() => {});
  }, [isAdmin]);

  function reloadFull() { if (setupCourseId) loadCourseFull(setupCourseId); }

  // ── Actions ──
  async function createCourse() {
    if (!newCode || !newTitle) { toast.error("Заполните код и название"); return; }
    try {
      await teaching.createCourse(newCode, newTitle, newYear);
      toast.success("Курс создан");
      courses.list().then(setCourseList);
      setNewCode(""); setNewTitle("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addModule() {
    if (!setupCourseId || !modTitle || !modStart || !modEnd) {
      toast.error("Выберите курс и заполните все поля модуля"); return;
    }
    try {
      const id = await teaching.addModule(setupCourseId, parseInt(modNum), modTitle, modStart, modEnd);
      toast.success("Модуль добавлен");
      const label = `М${modNum}: ${modTitle}`;
      setLocalModules((p) => [...p, { id, label }]);
      setModTitle("");
      reloadFull();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addActivity() {
    if (!selectedModuleId || !actTitle || !actStart || !actEnd) {
      toast.error("Выберите модуль и заполните все поля занятия"); return;
    }
    try {
      const id = await teaching.addActivity(selectedModuleId, parseInt(actType), actTitle, actStart, actEnd);
      toast.success("Занятие добавлено");
      const typeLabel = ACTIVITY_TYPES.find((t) => t.value === parseInt(actType))?.label ?? "";
      setLocalActivities((p) => [...p, { id, label: `${typeLabel}: ${actTitle}` }]);
      setActTitle("");
      reloadFull();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addTaskSet() {
    if (!selectedActivityId || !tsTitle) { toast.error("Выберите занятие и введите название"); return; }
    try {
      const id = await teaching.addTaskSet(selectedActivityId, tsTitle);
      toast.success("Набор задач добавлен");
      setLocalTaskSets((p) => [...p, { id, label: tsTitle }]);
      setTsTitle("");
      reloadFull();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addTask(taskSetId: string) {
    if (!taskCode || !taskTitle || !taskPoints) { toast.error("Заполните код, название и баллы"); return; }
    try {
      await teaching.addTask(taskSetId, taskCode, taskTitle, null, parseFloat(taskPoints));
      toast.success("Задание добавлено");
      setTaskCode(""); setTaskTitle(""); setTaskPoints("1");
      reloadFull();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function saveRole(userId: string) {
    const roleName = roleChanges[userId];
    if (!roleName) return;
    try {
      await admin.setRole(userId, roleName);
      toast.success("Роль обновлена");
      admin.listUsers().then(setUserList);
      setRoleChanges((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  // Merge remote + local items for display
  const remoteModules = courseFull?.modules.map((m) => ({ id: m.id, label: `М${m.number}: ${m.title}` })) ?? [];
  const allModules: LocalItem[] = [
    ...remoteModules,
    ...localModules.filter((l) => !remoteModules.some((r) => r.id === l.id)),
  ];

  const remoteActivities = courseFull?.modules.find((m) => m.id === selectedModuleId)?.activities.map((a) => ({
    id: a.id,
    label: `${ACTIVITY_TYPES.find((t) => t.value === a.type)?.label}: ${a.title}`,
  })) ?? [];
  const allActivities: LocalItem[] = [
    ...remoteActivities,
    ...localActivities.filter((l) => !remoteActivities.some((r) => r.id === l.id)),
  ];

  const remoteTaskSets = courseFull?.modules.find((m) => m.id === selectedModuleId)?.activities.find((a) => a.id === selectedActivityId)?.taskSets.map((ts) => ({
    id: ts.id,
    label: ts.title,
    tasks: ts.tasks,
  })) ?? [];
  const allTaskSets = [
    ...remoteTaskSets,
    ...localTaskSets.filter((l) => !remoteTaskSets.some((r) => r.id === l.id)).map((l) => ({ ...l, tasks: [] })),
  ];

  const markColor = (mark: string) => {
    if (mark.startsWith("5")) return "text-[#059669] bg-[#D1FAE5]";
    if (mark.startsWith("4")) return "text-[#005BFF] bg-[#EAF2FF]";
    if (mark.startsWith("3")) return "text-[#D97706] bg-[#FEF3C7]";
    return "text-[#DC2626] bg-[#FEE2E2]";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Управление</h1>

      {/* ── Настройка курса ── */}
      <div className={card}>
        <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Настройка курса</p>

        {/* Create course */}
        <div className="flex flex-wrap gap-3 items-end pb-3 border-b border-[#F3F4F6]">
          <div>
            <label className="block text-xs text-[#6B7280] mb-1">Код</label>
            <input className={`${inp} w-24`} value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="MKN2" />
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] mb-1">Название</label>
            <input className={`${inp} w-56`} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Математика для КН ч.2" />
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] mb-1">Учебный год</label>
            <input className={`${inp} w-28`} value={newYear} onChange={(e) => setNewYear(e.target.value)} />
          </div>
          <button onClick={createCourse} className={btn}><PlusCircle size={15} /> Создать курс</button>
        </div>

        {/* Course selector */}
        {courseList.length === 0 ? (
          <p className="text-sm text-[#9CA3AF]">Нет курсов — создайте первый выше.</p>
        ) : (
          <div>
            <p className="text-xs text-[#6B7280] mb-2">Выберите курс для настройки:</p>
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
        )}

        {/* Module management (always visible when course selected) */}
        {setupCourseId && (
          <div className="space-y-4 border-t border-[#F3F4F6] pt-4">
            {/* Module list */}
            {(allModules.length > 0 || fullLoading) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-[#1A1A1B]">Модули</p>
                  {fullLoading && <RefreshCw size={11} className="text-[#9CA3AF] animate-spin" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allModules.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModuleId(m.id === selectedModuleId ? null : m.id); setSelectedActivityId(null); }}
                      className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-1 transition-colors ${
                        selectedModuleId === m.id ? "bg-[#005BFF] text-white border-[#005BFF]" : "bg-[#F9FAFB] text-[#1A1A1B] border-[#E5E7EB] hover:border-[#005BFF]/40"
                      }`}
                    >
                      {m.label}
                      {selectedModuleId === m.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add module form */}
            <div className="bg-[#F9FAFB] rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-[#6B7280]">Добавить модуль</p>
              <div className="flex flex-wrap gap-2">
                <input className={`${inp} w-16`} type="number" min="1" max="3" placeholder="№" value={modNum} onChange={(e) => setModNum(e.target.value)} />
                <input className={`${inp} w-44`} placeholder="Название" value={modTitle} onChange={(e) => setModTitle(e.target.value)} />
                <input className={`${inp} w-44`} type="datetime-local" value={modStart} onChange={(e) => setModStart(e.target.value)} />
                <input className={`${inp} w-44`} type="datetime-local" value={modEnd} onChange={(e) => setModEnd(e.target.value)} />
                <button onClick={addModule} className={btn}><PlusCircle size={14} /> Модуль</button>
              </div>
            </div>

            {/* Activity management (always visible when module selected) */}
            {selectedModuleId && (
              <div className="ml-4 space-y-4 border-l-2 border-[#EAF2FF] pl-4">
                {/* Activity list */}
                {allActivities.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#1A1A1B] mb-2">Занятия</p>
                    <div className="flex flex-wrap gap-2">
                      {allActivities.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => { setSelectedActivityId(a.id === selectedActivityId ? null : a.id); setExpandedTsId(null); }}
                          className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-1 transition-colors ${
                            selectedActivityId === a.id ? "bg-[#005BFF] text-white border-[#005BFF]" : "bg-[#F9FAFB] text-[#1A1A1B] border-[#E5E7EB] hover:border-[#005BFF]/40"
                          }`}
                        >
                          {a.label}
                          {selectedActivityId === a.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add activity form */}
                <div className="bg-[#F9FAFB] rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-[#6B7280]">Добавить занятие</p>
                  <div className="flex flex-wrap gap-2">
                    <select className={`${inp} w-36`} value={actType} onChange={(e) => setActType(e.target.value)}>
                      {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input className={`${inp} w-44`} placeholder="Название" value={actTitle} onChange={(e) => setActTitle(e.target.value)} />
                    <input className={`${inp} w-44`} type="datetime-local" value={actStart} onChange={(e) => setActStart(e.target.value)} />
                    <input className={`${inp} w-44`} type="datetime-local" value={actEnd} onChange={(e) => setActEnd(e.target.value)} />
                    <button onClick={addActivity} className={btn}><PlusCircle size={14} /> Занятие</button>
                  </div>
                </div>

                {/* Task set management (always visible when activity selected) */}
                {selectedActivityId && (
                  <div className="ml-4 space-y-3 border-l-2 border-[#FEF3C7] pl-4">
                    {/* Task set list */}
                    {allTaskSets.map((ts) => (
                      <div key={ts.id} className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedTsId(ts.id === expandedTsId ? null : ts.id)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-[#F9FAFB] text-sm text-[#1A1A1B] hover:bg-[#F3F4F6] transition-colors"
                        >
                          <span className="font-medium">{ts.label}</span>
                          {expandedTsId === ts.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        {expandedTsId === ts.id && (
                          <div className="p-3 space-y-2">
                            {ts.tasks.length > 0 && (
                              <table className="w-full text-xs mb-2">
                                <thead><tr className="text-[#6B7280]">
                                  <th className="text-left pb-1">Код</th>
                                  <th className="text-left pb-1">Название</th>
                                  <th className="text-right pb-1">Баллы</th>
                                </tr></thead>
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
                            <div className="flex flex-wrap gap-2 pt-1 border-t border-[#F3F4F6]">
                              <input className={`${inp} w-16`} placeholder="Код" value={taskCode} onChange={(e) => setTaskCode(e.target.value)} />
                              <input className={`${inp} w-40`} placeholder="Название" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                              <input className={`${inp} w-16`} type="number" min="0" step="0.5" placeholder="Баллы" value={taskPoints} onChange={(e) => setTaskPoints(e.target.value)} />
                              <button onClick={() => addTask(ts.id)} className={btn}><PlusCircle size={13} /> Задание</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add task set form */}
                    <div className="bg-[#FFFBEB] rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-[#6B7280]">Добавить набор задач</p>
                      <div className="flex gap-2">
                        <input className={`${inp} flex-1`} placeholder="Название набора" value={tsTitle} onChange={(e) => setTsTitle(e.target.value)} />
                        <button onClick={addTaskSet} className={btn}><PlusCircle size={13} /> Набор задач</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Таблица баллов ── */}
      {courseList.length > 0 && (
        <div className={card}>
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
                    const byMod = (n: number) => s.modules.find((m) => m.moduleNumber === n)?.moduleScore ?? 0;
                    return (
                      <tr key={s.studentId} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-4 py-3 font-medium text-[#1A1A1B]">{s.displayName}</td>
                        <td className="text-right px-4 py-3 text-[#6B7280]">{byMod(1).toFixed(1)}</td>
                        <td className="text-right px-4 py-3 text-[#6B7280]">{byMod(2).toFixed(1)}</td>
                        <td className="text-right px-4 py-3 text-[#6B7280]">{byMod(3).toFixed(1)}</td>
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

      {/* ── Пользователи (только Admin) ── */}
      {isAdmin && (
        <div className={card}>
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
                          onChange={(e) => setRoleChanges((p) => ({ ...p, [u.id]: e.target.value }))}
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
