"use client";
import { useEffect, useState, useCallback } from "react";
import {
  courses, Course, StudentScore, teaching, admin,
  CourseStructure, teachingApi, TeacherActivity,
  assistantApps, AssistantApplicationDto, ActivityTeam,
} from "@/lib/api";
import { toast } from "sonner";
import {
  PlusCircle, ChevronRight, Play, Square, Users,
  Trash2, RefreshCw, Link2, FileText, Video, ExternalLink,
} from "lucide-react";

type Tab = "courses" | "structure" | "materials" | "students" | "scores" | "schedule" | "teams";

// ─── helpers ────────────────────────────────────────────────────────────────
const INPUT =
  "h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition bg-white";
const BTN_PRIMARY =
  "h-9 px-4 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] disabled:opacity-60 transition-colors flex items-center gap-1.5";
const BTN_GHOST =
  "h-9 px-3 rounded-lg border border-[#E5E7EB] text-xs text-[#1A1A1B] hover:bg-[#F3F4F6] transition-colors flex items-center gap-1.5";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-[#6B7280] mb-1">{children}</label>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-[#E5E7EB] p-5 ${className}`}>{children}</div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">{children}</p>;
}

const STATUS_BADGE: Record<string, string> = {
  Active: "bg-[#D1FAE5] text-[#059669]",
  Finished: "bg-[#F3F4F6] text-[#9CA3AF]",
  Scheduled: "bg-[#FEF3C7] text-[#D97706]",
};
const STATUS_LABEL: Record<string, string> = {
  Active: "Идёт", Finished: "Завершено", Scheduled: "Запланировано",
};

// ─── component ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("courses");
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  // Courses tab
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newYear, setNewYear] = useState("2024/2025");

  // Structure tab
  const [structure, setStructure] = useState<CourseStructure | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleNum, setModuleNum] = useState("1");
  const [moduleStart, setModuleStart] = useState("");
  const [moduleEnd, setModuleEnd] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [actTitle, setActTitle] = useState("");
  const [actType, setActType] = useState("0");
  const [actStart, setActStart] = useState("");
  const [actEnd, setActEnd] = useState("");
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [taskSetTitle, setTaskSetTitle] = useState("");
  const [selectedTaskSetId, setSelectedTaskSetId] = useState<string | null>(null);
  const [taskCode, setTaskCode] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPoints, setTaskPoints] = useState("1");

  // Materials tab
  const [matActivity, setMatActivity] = useState<TeacherActivity | null>(null);
  const [matVideoUrl, setMatVideoUrl] = useState("");
  const [matTestUrl, setMatTestUrl] = useState("");
  const [matFileUrl, setMatFileUrl] = useState("");
  const [matSaving, setMatSaving] = useState(false);

  // Students tab
  const [courseStudents, setCourseStudents] = useState<{ id: string; email: string; displayName: string; role: string }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; email: string; displayName: string; role: string }[]>([]);
  const [bulkEmails, setBulkEmails] = useState("");

  // Scores tab
  const [allScores, setAllScores] = useState<StudentScore[]>([]);

  // Schedule tab
  const [scheduleActivities, setScheduleActivities] = useState<TeacherActivity[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [appsActivityId, setAppsActivityId] = useState<string | null>(null);
  const [applications, setApplications] = useState<AssistantApplicationDto[]>([]);

  // Teams tab
  const [teamsActivityId, setTeamsActivityId] = useState<string | null>(null);
  const [teamSize, setTeamSize] = useState("5");
  const [teams, setTeams] = useState<ActivityTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── data loaders ───────────────────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    const list = await courses.list().catch(() => [] as Course[]);
    setCourseList(list);
  }, []);

  const loadStructure = useCallback(async () => {
    if (!selected) return;
    setStructureLoading(true);
    try {
      const s = await courses.structure(selected);
      setStructure(s);
    } catch {
      setStructure(null);
      toast.error("Не удалось загрузить структуру курса");
    } finally {
      setStructureLoading(false);
    }
  }, [selected]);

  const loadStudents = useCallback(async () => {
    if (!selected) return;
    try {
      const [enrolled, all] = await Promise.all([
        teachingApi.getCourseStudents(selected),
        admin.listUsers(),
      ]);
      setCourseStudents(enrolled);
      setAllUsers(all);
    } catch { /* ignore */ }
  }, [selected]);

  const loadSchedule = useCallback(async () => {
    if (!selected) return;
    setScheduleLoading(true);
    try {
      const acts = await teachingApi.getCourseActivities(selected);
      setScheduleActivities(acts);
    } catch { setScheduleActivities([]); }
    finally { setScheduleLoading(false); }
  }, [selected]);

  const loadTeams = useCallback(async (activityId: string) => {
    setTeamsLoading(true);
    try {
      const t = await teaching.getTeams(activityId);
      setTeams(t);
    } catch { setTeams([]); }
    finally { setTeamsLoading(false); }
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  useEffect(() => {
    if (!selected) return;
    if (tab === "scores") courses.scores(selected).then(setAllScores).catch(() => setAllScores([]));
    if (tab === "structure") loadStructure();
    if (tab === "students") loadStudents();
    if (tab === "schedule") loadSchedule();
    if (tab === "materials") loadSchedule();
    if (tab === "teams") loadSchedule();
  }, [selected, tab, loadStructure, loadStudents, loadSchedule]);

  // ── courses tab ────────────────────────────────────────────────────────────
  async function createCourse() {
    if (!newCode || !newTitle) { toast.error("Заполните код и название"); return; }
    try {
      await teaching.createCourse(newCode, newTitle, newYear);
      toast.success("Курс создан");
      setNewCode(""); setNewTitle("");
      await loadCourses();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function deleteCourse(courseId: string, code: string) {
    if (!confirm(`Удалить курс ${code}? Это действие нельзя отменить.`)) return;
    try {
      await teaching.deleteCourse(courseId);
      toast.success("Курс удалён");
      if (selected === courseId) setSelected(null);
      await loadCourses();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  // ── structure tab ──────────────────────────────────────────────────────────
  async function addModule() {
    if (!selected || !moduleTitle || !moduleStart || !moduleEnd) {
      toast.error("Заполните все поля модуля"); return;
    }
    const start = new Date(moduleStart);
    const end = new Date(moduleEnd);
    if (end <= start) { toast.error("Дата окончания должна быть позже даты начала"); return; }
    try {
      await teaching.addModule(selected, parseInt(moduleNum), moduleTitle, start.toISOString(), end.toISOString());
      toast.success("Модуль добавлен");
      setModuleTitle(""); setModuleStart(""); setModuleEnd("");
      await loadStructure();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addActivity(moduleId: string) {
    if (!actTitle || !actStart || !actEnd) {
      toast.error("Заполните название и даты занятия"); return;
    }
    const start = new Date(actStart);
    const end = new Date(actEnd);
    if (end <= start) { toast.error("Дата окончания должна быть позже даты начала"); return; }

    // Validate against module dates using DATE-ONLY strings (avoids timezone mismatch)
    const mod = structure?.modules.find(m => m.id === moduleId);
    if (mod) {
      const startDate = actStart.slice(0, 10);   // "YYYY-MM-DD" from datetime-local
      const endDate = actEnd.slice(0, 10);
      const mStartDate = mod.startsAt.slice(0, 10);
      const mEndDate = mod.endsAt.slice(0, 10);
      if (startDate < mStartDate || endDate > mEndDate) {
        toast.error(`Занятие должно быть в пределах дат модуля: ${new Date(mod.startsAt).toLocaleDateString("ru")} — ${new Date(mod.endsAt).toLocaleDateString("ru")}`);
        return;
      }
    }
    try {
      await teaching.addActivity(moduleId, parseInt(actType), actTitle, start.toISOString(), end.toISOString());
      toast.success("Занятие добавлено");
      setActTitle(""); setActStart(""); setActEnd("");
      setSelectedModuleId(null); // close inline form
      await loadStructure();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addTaskSet() {
    if (!selectedActId || !taskSetTitle) { toast.error("Выберите занятие и введите название"); return; }
    try {
      await teaching.addTaskSet(selectedActId, taskSetTitle);
      toast.success("Набор задач добавлен");
      setTaskSetTitle(""); await loadStructure();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function addTask() {
    if (!selectedTaskSetId || !taskCode || !taskTitle) { toast.error("Заполните данные задачи"); return; }
    try {
      await teaching.addTask(selectedTaskSetId, taskCode, taskTitle, null, parseFloat(taskPoints));
      toast.success("Задача добавлена");
      setTaskCode(""); setTaskTitle(""); await loadStructure();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  // ── materials tab ──────────────────────────────────────────────────────────
  function selectMatActivity(act: TeacherActivity) {
    setMatActivity(act);
    setMatVideoUrl(act.preLectureVideoUrl ?? "");
    setMatTestUrl(act.theoryTestUrl ?? "");
    setMatFileUrl(act.taskFileUrl ?? "");
  }

  async function saveMaterials() {
    if (!matActivity) return;
    setMatSaving(true);
    try {
      await teaching.patchMaterials(matActivity.id, {
        preLectureVideoUrl: matVideoUrl,
        theoryTestUrl: matTestUrl,
        taskFileUrl: matFileUrl,
      });
      toast.success("Материалы сохранены");
      await loadSchedule();
      setMatActivity(a => a ? { ...a, preLectureVideoUrl: matVideoUrl || undefined, theoryTestUrl: matTestUrl || undefined, taskFileUrl: matFileUrl || undefined } : a);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
    finally { setMatSaving(false); }
  }

  // ── students tab ───────────────────────────────────────────────────────────
  async function enrollBulk() {
    if (!selected || !bulkEmails.trim()) { toast.error("Выберите курс и введите email-адреса"); return; }
    const emails = bulkEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    try {
      const r = await teachingApi.enrollBulk(selected, emails);
      toast.success(`Добавлено: ${r.added}. Не найдено: ${r.notFound}`);
      setBulkEmails("");
      await loadStudents();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function setRole(userId: string, roleName: string) {
    try {
      await admin.setUserRole(userId, roleName);
      toast.success("Роль обновлена");
      await loadStudents();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  // ── schedule tab ───────────────────────────────────────────────────────────
  async function startActivity(id: string) {
    try {
      const r = await teachingApi.startActivity(id);
      toast.success("Занятие начато — студенты получили уведомление");
      if (r?.theoryTestUrl) {
        toast.info(`Мини-тест отправлен студентам: ${r.theoryTestUrl}`, { duration: 8000 });
      }
      await loadSchedule();
    }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function finishActivity(id: string) {
    try { await teachingApi.finishActivity(id); toast.success("Занятие завершено"); await loadSchedule(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function loadApplications(activityId: string) {
    try {
      const apps = await assistantApps.list(activityId);
      setApplications(apps);
      setAppsActivityId(activityId);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  async function reviewApplication(appId: string, approved: boolean) {
    if (!appsActivityId) return;
    try {
      await assistantApps.review(appsActivityId, appId, approved);
      toast.success(approved ? "Заявка одобрена" : "Заявка отклонена");
      await loadApplications(appsActivityId);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  }

  // ── teams tab ──────────────────────────────────────────────────────────────
  async function generateTeams() {
    if (!teamsActivityId) { toast.error("Выберите занятие"); return; }
    const sz = parseInt(teamSize);
    if (isNaN(sz) || sz < 2 || sz > 10) { toast.error("Размер команды: от 2 до 10"); return; }
    setGenerating(true);
    try {
      const r = await teaching.autoGenerate(teamsActivityId, sz);
      toast.success(`Создано ${r.teamCount} команд (${r.studentCount} студентов)`);
      setTeams(r.teams);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
    finally { setGenerating(false); }
  }

  async function pickTeamsActivity(actId: string) {
    setTeamsActivityId(actId);
    await loadTeams(actId);
  }

  // ── scores helpers ─────────────────────────────────────────────────────────
  const markColor = (mark: string) => {
    if (mark.startsWith("5")) return "text-[#059669] bg-[#D1FAE5]";
    if (mark.startsWith("4")) return "text-[#005BFF] bg-[#EAF2FF]";
    if (mark.startsWith("3")) return "text-[#D97706] bg-[#FEF3C7]";
    return "text-[#DC2626] bg-[#FEE2E2]";
  };

  const activityTypeLabels: Record<string, string> = { "0": "Лекция", "1": "КТ", "2": "ДЗ-сессия" };

  const tabs: { key: Tab; label: string }[] = [
    { key: "courses", label: "Курсы" },
    { key: "structure", label: "Структура" },
    { key: "materials", label: "Задания" },
    { key: "students", label: "Студенты" },
    { key: "scores", label: "Баллы" },
    { key: "schedule", label: "Расписание" },
    { key: "teams", label: "Команды" },
  ];

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Управление</h1>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-[#F3F4F6] rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white text-[#005BFF] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A1B]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Course selector (for non-courses tabs) */}
      {tab !== "courses" && (
        <Card>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-2">Выберите курс</p>
          <div className="flex flex-wrap gap-2">
            {courseList.map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id === selected ? null : c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  selected === c.id
                    ? "bg-[#005BFF] text-white border-[#005BFF]"
                    : "bg-white text-[#1A1A1B] border-[#E5E7EB] hover:border-[#005BFF]/40"
                }`}>
                {c.code} — {c.title}
              </button>
            ))}
            {courseList.length === 0 && <p className="text-sm text-[#9CA3AF]">Нет курсов. Создайте на вкладке Курсы.</p>}
          </div>
        </Card>
      )}

      {/* ══ TAB: COURSES ══════════════════════════════════════════════════════ */}
      {tab === "courses" && (
        <div className="space-y-5">
          <Card>
            <SectionTitle>Создать курс</SectionTitle>
            <div className="flex flex-wrap gap-3 items-end">
              <div><Label>Код</Label><input className={`${INPUT} w-24`} value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="MKN2" /></div>
              <div><Label>Название</Label><input className={`${INPUT} w-56`} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Математика для КН ч.2" /></div>
              <div><Label>Учебный год</Label><input className={`${INPUT} w-28`} value={newYear} onChange={e => setNewYear(e.target.value)} /></div>
              <button onClick={createCourse} className={BTN_PRIMARY}><PlusCircle size={15} />Создать</button>
            </div>
          </Card>

          {courseList.length > 0 && (
            <Card>
              <SectionTitle>Все курсы</SectionTitle>
              <div className="divide-y divide-[#F3F4F6]">
                {courseList.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <span className="text-sm font-semibold text-[#1A1A1B]">{c.code}</span>
                      <span className="text-sm text-[#6B7280] ml-2">{c.title}</span>
                      <span className="text-xs text-[#9CA3AF] ml-2">{c.academicYear}</span>
                    </div>
                    <button onClick={() => deleteCourse(c.id, c.code)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-red-50 transition-colors"
                      title="Удалить курс">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══ TAB: STRUCTURE ════════════════════════════════════════════════════ */}
      {tab === "structure" && selected && (
        <div className="space-y-5">
          {/* Add module */}
          <Card>
            <SectionTitle>Добавить модуль</SectionTitle>
            <div className="flex flex-wrap gap-3 items-end">
              <div><Label>Номер</Label><input className={`${INPUT} w-16`} type="number" value={moduleNum} onChange={e => setModuleNum(e.target.value)} /></div>
              <div><Label>Название</Label><input className={`${INPUT} w-44`} value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="Модуль 1" /></div>
              <div><Label>Начало</Label><input className={INPUT} type="date" value={moduleStart} onChange={e => setModuleStart(e.target.value)} /></div>
              <div><Label>Конец</Label><input className={INPUT} type="date" value={moduleEnd} onChange={e => setModuleEnd(e.target.value)} /></div>
              <button onClick={addModule} className={BTN_PRIMARY}><PlusCircle size={14} />Добавить</button>
            </div>
          </Card>

          {/* Add task set */}
          <Card>
            <SectionTitle>Добавить набор задач</SectionTitle>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label>Занятие</Label>
                <select className={`${INPUT} pr-8`} value={selectedActId ?? ""} onChange={e => setSelectedActId(e.target.value || null)}>
                  <option value="">— выберите —</option>
                  {structure?.modules.flatMap(m => m.activities.map(a => (
                    <option key={a.id} value={a.id}>
                      М{m.number} / {a.title} ({activityTypeLabels[a.type === "Lecture" ? "0" : a.type === "ControlPoint" ? "1" : "2"] ?? a.type})
                    </option>
                  )))}
                </select>
              </div>
              <div><Label>Название набора</Label><input className={`${INPUT} w-44`} value={taskSetTitle} onChange={e => setTaskSetTitle(e.target.value)} placeholder="КТ вариант А" /></div>
              <button onClick={addTaskSet} className={BTN_PRIMARY}><PlusCircle size={14} />Добавить</button>
            </div>
          </Card>

          {/* Add task */}
          <Card>
            <SectionTitle>Добавить задачу</SectionTitle>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label>Набор задач</Label>
                <select className={`${INPUT} pr-8`} value={selectedTaskSetId ?? ""} onChange={e => setSelectedTaskSetId(e.target.value || null)}>
                  <option value="">— выберите —</option>
                  {structure?.modules.flatMap(m => m.activities.flatMap(a =>
                    a.taskSets.map(ts => (
                      <option key={ts.id} value={ts.id}>М{m.number} / {a.title} / {ts.title}</option>
                    ))
                  ))}
                </select>
              </div>
              <div><Label>Код</Label><input className={`${INPUT} w-20`} value={taskCode} onChange={e => setTaskCode(e.target.value)} placeholder="A1" /></div>
              <div><Label>Название</Label><input className={`${INPUT} w-44`} value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Задача 1" /></div>
              <div><Label>Баллы</Label><input className={`${INPUT} w-20`} type="number" value={taskPoints} onChange={e => setTaskPoints(e.target.value)} /></div>
              <button onClick={addTask} className={BTN_PRIMARY}><PlusCircle size={14} />Добавить</button>
            </div>
          </Card>

          {/* Tree */}
          {structureLoading && <p className="text-sm text-[#6B7280] animate-pulse">Загрузка структуры...</p>}
          {!structureLoading && (
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                Структура: {structure?.code} — {structure?.title}
              </p>
              <button onClick={loadStructure} className={BTN_GHOST}><RefreshCw size={13} />Обновить</button>
            </div>
          )}
          {!structureLoading && structure && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="p-4 space-y-3">
                {structure.modules.length === 0 && (
                  <p className="text-sm text-[#9CA3AF] text-center py-4">Нет модулей. Добавьте модуль выше.</p>
                )}
                {structure.modules.map(m => (
                  <div key={m.id} className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                    {/* Module header */}
                    <div className="bg-[#F9FAFB] px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#005BFF] uppercase">М{m.number}</span>
                        <span className="text-sm font-semibold text-[#1A1A1B]">{m.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#9CA3AF]">
                          {new Date(m.startsAt).toLocaleDateString("ru")} — {new Date(m.endsAt).toLocaleDateString("ru")}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedModuleId(selectedModuleId === m.id ? null : m.id);
                            setActTitle(""); setActStart(""); setActEnd(""); setActType("0");
                          }}
                          className={`flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                            selectedModuleId === m.id
                              ? "bg-[#005BFF] text-white"
                              : "bg-[#EAF2FF] text-[#005BFF] hover:bg-[#D1E6FF]"
                          }`}>
                          <PlusCircle size={12} />Занятие
                        </button>
                      </div>
                    </div>

                    {/* Inline add-activity form */}
                    {selectedModuleId === m.id && (
                      <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFBFF]">
                        <p className="text-xs text-[#9CA3AF] mb-2">
                          Период модуля: {new Date(m.startsAt).toLocaleDateString("ru")} — {new Date(m.endsAt).toLocaleDateString("ru")}
                        </p>
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <Label>Тип</Label>
                            <select className={`${INPUT} pr-8`} value={actType} onChange={e => setActType(e.target.value)}>
                              <option value="0">Лекция</option>
                              <option value="1">КТ</option>
                              <option value="2">ДЗ-сессия</option>
                            </select>
                          </div>
                          <div>
                            <Label>Название</Label>
                            <input className={`${INPUT} w-40`} value={actTitle} onChange={e => setActTitle(e.target.value)} placeholder="Лекция 1" autoFocus />
                          </div>
                          <div>
                            <Label>Начало</Label>
                            <input className={INPUT} type="datetime-local" value={actStart} onChange={e => setActStart(e.target.value)} />
                          </div>
                          <div>
                            <Label>Конец</Label>
                            <input className={INPUT} type="datetime-local" value={actEnd} onChange={e => setActEnd(e.target.value)} />
                          </div>
                          <button onClick={() => addActivity(m.id)} className={BTN_PRIMARY}>
                            <PlusCircle size={14} />Добавить
                          </button>
                          <button onClick={() => setSelectedModuleId(null)} className={BTN_GHOST}>
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Activities list */}
                    {m.activities.length === 0 && selectedModuleId !== m.id && (
                      <p className="px-4 py-3 text-xs text-[#9CA3AF]">Нет занятий — нажмите «+ Занятие» выше</p>
                    )}
                    {m.activities.length > 0 && (
                      <div className="divide-y divide-[#F3F4F6]">
                        {m.activities.map(a => (
                          <div key={a.id} className="px-4 py-2.5">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <ChevronRight size={12} className="text-[#9CA3AF] flex-shrink-0" />
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                a.type === "ControlPoint" ? "bg-[#FEF3C7] text-[#D97706]" :
                                a.type === "Lecture" ? "bg-[#EAF2FF] text-[#005BFF]" :
                                "bg-[#F3F4F6] text-[#6B7280]"
                              }`}>
                                {activityTypeLabels[a.type === "Lecture" ? "0" : a.type === "ControlPoint" ? "1" : "2"] ?? a.type}
                              </span>
                              <span className="text-sm font-medium text-[#1A1A1B]">{a.title}</span>
                              <span className="text-xs text-[#9CA3AF]">
                                {new Date(a.startsAt).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            {a.taskSets.map(ts => (
                              <div key={ts.id} className="ml-5 mt-1">
                                <p className="text-xs text-[#6B7280] font-medium">{ts.title}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {ts.tasks.map(t => (
                                    <span key={t.id} className="text-xs bg-[#EAF2FF] text-[#005BFF] px-2 py-0.5 rounded font-mono">{t.code} ({t.points}б)</span>
                                  ))}
                                  {ts.tasks.length === 0 && <span className="text-xs text-[#9CA3AF]">нет задач</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "structure" && !selected && <p className="text-sm text-[#9CA3AF]">Выберите курс выше.</p>}

      {/* ══ TAB: MATERIALS ════════════════════════════════════════════════════ */}
      {tab === "materials" && selected && (
        <div className="space-y-5">
          {/* Activity list */}
          <Card>
            <SectionTitle>Выберите занятие</SectionTitle>
            {scheduleLoading && <p className="text-sm text-[#9CA3AF]">Загрузка...</p>}
            {!scheduleLoading && scheduleActivities.length === 0 && (
              <p className="text-sm text-[#9CA3AF]">Нет занятий. Добавьте их на вкладке Структура.</p>
            )}
            <div className="space-y-1.5">
              {scheduleActivities.map(a => (
                <button
                  key={a.id}
                  onClick={() => selectMatActivity(a)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    matActivity?.id === a.id
                      ? "border-[#005BFF] bg-[#EAF2FF]"
                      : "border-[#E5E7EB] hover:border-[#005BFF]/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#6B7280] mr-2">М{a.moduleNumber} / {a.typeLabel}</span>
                      <span className="text-sm font-medium text-[#1A1A1B]">{a.title}</span>
                    </div>
                    {(a.preLectureVideoUrl || a.theoryTestUrl || a.taskFileUrl) && (
                      <span className="text-xs text-[#059669] bg-[#D1FAE5] px-2 py-0.5 rounded-full">материалы</span>
                    )}
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    {new Date(a.startsAt).toLocaleString("ru", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          {/* Material editor */}
          {matActivity && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1B]">{matActivity.title}</p>
                  <p className="text-xs text-[#6B7280]">М{matActivity.moduleNumber} / {matActivity.typeLabel}</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Pre-lecture video — only for Lecture */}
                {matActivity.typeLabel === "Лекция" && (
                  <div>
                    <Label><span className="flex items-center gap-1.5"><Video size={12} />Видео для просмотра до лекции (YouTube / другая ссылка)</span></Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                          type="url"
                          className={`${INPUT} w-full pl-8`}
                          placeholder="https://youtube.com/..."
                          value={matVideoUrl}
                          onChange={e => setMatVideoUrl(e.target.value)}
                        />
                      </div>
                      {matVideoUrl && (
                        <a href={matVideoUrl} target="_blank" rel="noopener noreferrer"
                          className={`${BTN_GHOST} text-[#005BFF]`}>
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Theory test — only for Lecture */}
                {matActivity.typeLabel === "Лекция" && (
                  <div>
                    <Label><span className="flex items-center gap-1.5"><FileText size={12} />Тест на теорию (Google Forms)</span></Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                          type="url"
                          className={`${INPUT} w-full pl-8`}
                          placeholder="https://forms.google.com/..."
                          value={matTestUrl}
                          onChange={e => setMatTestUrl(e.target.value)}
                        />
                      </div>
                      {matTestUrl && (
                        <a href={matTestUrl} target="_blank" rel="noopener noreferrer"
                          className={`${BTN_GHOST} text-[#005BFF]`}>
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Task file — for all types */}
                <div>
                  <Label>
                    <span className="flex items-center gap-1.5">
                      <FileText size={12} />
                      {matActivity.typeLabel === "Лекция" ? "Файл с заданиями для лекции" : "Файл с заданиями КТ"}
                      {" "}(Google Drive / другая ссылка)
                    </span>
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                      <input
                        type="url"
                        className={`${INPUT} w-full pl-8`}
                        placeholder="https://drive.google.com/..."
                        value={matFileUrl}
                        onChange={e => setMatFileUrl(e.target.value)}
                      />
                    </div>
                    {matFileUrl && (
                      <a href={matFileUrl} target="_blank" rel="noopener noreferrer"
                        className={`${BTN_GHOST} text-[#005BFF]`}>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>

                <button onClick={saveMaterials} disabled={matSaving} className={BTN_PRIMARY}>
                  {matSaving ? "Сохранение..." : "Сохранить материалы"}
                </button>
              </div>
            </Card>
          )}
        </div>
      )}
      {tab === "materials" && !selected && <p className="text-sm text-[#9CA3AF]">Выберите курс выше.</p>}

      {/* ══ TAB: STUDENTS ═════════════════════════════════════════════════════ */}
      {tab === "students" && (
        <div className="space-y-5">
          {/* Bulk enroll */}
          {selected && (
            <Card>
              <SectionTitle>Массовая запись студентов на курс</SectionTitle>
              <textarea
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition resize-none"
                placeholder={"student1@edu.ru\nstudent2@edu.ru\n(каждый email на новой строке)"}
                value={bulkEmails}
                onChange={e => setBulkEmails(e.target.value)}
              />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={enrollBulk} className={BTN_PRIMARY}>Записать студентов</button>
                <p className="text-xs text-[#9CA3AF]">Email должен совпадать с зарегистрированным в системе</p>
              </div>
            </Card>
          )}

          {/* Enrolled students list */}
          {selected && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                <p className="text-sm font-semibold text-[#1A1A1B]">
                  Записаны на курс ({courseStudents.length})
                </p>
                <button onClick={loadStudents} className={BTN_GHOST}><RefreshCw size={13} />Обновить</button>
              </div>
              {courseStudents.length === 0 ? (
                <p className="px-5 py-4 text-sm text-[#9CA3AF]">Нет студентов, записанных на этот курс</p>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {courseStudents.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1B]">{u.displayName}</p>
                        <p className="text-xs text-[#6B7280]">{u.email}</p>
                      </div>
                      <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded">{u.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All users + role management */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1A1A1B]">Все пользователи ({allUsers.length})</p>
              <button onClick={() => admin.listUsers().then(setAllUsers).catch(() => {})} className={BTN_GHOST}><RefreshCw size={13} />Обновить</button>
            </div>
            {allUsers.length === 0 ? (
              <p className="px-5 py-4 text-sm text-[#9CA3AF]">Нет пользователей</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {allUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1B]">{u.displayName}</p>
                      <p className="text-xs text-[#6B7280]">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        u.role === "Teacher" || u.role === "Admin" ? "bg-[#EAF2FF] text-[#005BFF]" :
                        u.role === "Assistant" ? "bg-[#FEF3C7] text-[#D97706]" : "bg-[#F3F4F6] text-[#6B7280]"
                      }`}>{u.role}</span>
                      <select
                        defaultValue=""
                        onChange={e => { if (e.target.value) setRole(u.id, e.target.value); e.target.value = ""; }}
                        className="h-8 px-2 rounded-lg border border-[#E5E7EB] text-xs outline-none focus:border-[#005BFF] bg-white transition"
                      >
                        <option value="">Изменить...</option>
                        <option value="Student">Student</option>
                        <option value="Assistant">Assistant</option>
                        <option value="Teacher">Teacher</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: SCORES ═══════════════════════════════════════════════════════ */}
      {tab === "scores" && selected && allScores.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB]">
            <p className="text-sm font-semibold text-[#1A1A1B]">Таблица баллов</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Студент</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">М1</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">М2</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">М3</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Итог</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Оценка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {allScores.map(s => {
                  const byModule = (n: number) => s.modules.find(m => m.moduleNumber === n)?.moduleScore ?? 0;
                  return (
                    <tr key={s.studentId} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-5 py-3 font-medium text-[#1A1A1B]">{s.displayName}</td>
                      <td className="text-right px-4 py-3 text-[#6B7280]">{byModule(1).toFixed(1)}</td>
                      <td className="text-right px-4 py-3 text-[#6B7280]">{byModule(2).toFixed(1)}</td>
                      <td className="text-right px-4 py-3 text-[#6B7280]">{byModule(3).toFixed(1)}</td>
                      <td className="text-right px-4 py-3 font-semibold text-[#1A1A1B]">{s.finalScore.toFixed(1)}</td>
                      <td className="text-right px-5 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${markColor(s.mark)}`}>{s.mark}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "scores" && selected && allScores.length === 0 && (
        <p className="text-sm text-[#9CA3AF]">Нет данных о баллах для выбранного курса.</p>
      )}
      {tab === "scores" && !selected && <p className="text-sm text-[#9CA3AF]">Выберите курс выше.</p>}

      {/* ══ TAB: SCHEDULE ═════════════════════════════════════════════════════ */}
      {tab === "schedule" && selected && (
        <div className="space-y-3">
          {scheduleLoading && <p className="text-sm text-[#6B7280] animate-pulse">Загрузка...</p>}
          {!scheduleLoading && scheduleActivities.length === 0 && (
            <p className="text-sm text-[#9CA3AF]">Нет занятий. Добавьте их на вкладке Структура.</p>
          )}
          {!scheduleLoading && scheduleActivities.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[#6B7280] font-medium">М{a.moduleNumber}</span>
                    <span className="text-xs text-[#9CA3AF]">{a.typeLabel}</span>
                    <span className="text-sm font-semibold text-[#1A1A1B] truncate">{a.title}</span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {new Date(a.startsAt).toLocaleString("ru", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" — "}
                    {new Date(a.endsAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[a.status] ?? "bg-[#F3F4F6] text-[#9CA3AF]"}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  {a.status === "Scheduled" && (
                    <button onClick={() => startActivity(a.id)}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] transition-colors">
                      <Play size={12} />Начать
                    </button>
                  )}
                  {a.status === "Active" && (
                    <button onClick={() => finishActivity(a.id)}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#EF4444] text-white text-xs font-medium hover:bg-[#DC2626] transition-colors">
                      <Square size={12} />Завершить
                    </button>
                  )}
                  <button
                    onClick={() => appsActivityId === a.id ? setAppsActivityId(null) : loadApplications(a.id)}
                    className={BTN_GHOST}>
                    <Users size={12} />Заявки ассистентов
                  </button>
                </div>
              </div>

              {appsActivityId === a.id && (
                <div className="mt-3 pt-3 border-t border-[#F3F4F6] space-y-2">
                  {applications.length === 0 && <p className="text-xs text-[#9CA3AF]">Заявок нет</p>}
                  {applications.map(app => (
                    <div key={app.id} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[#1A1A1B]">{app.assistantName}</p>
                        <p className="text-xs text-[#6B7280]">{app.assistantEmail}</p>
                        {app.message && <p className="text-xs text-[#9CA3AF] italic">{app.message}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {app.status === "Pending" ? (
                          <>
                            <button onClick={() => reviewApplication(app.id, true)}
                              className="h-7 px-3 rounded-lg bg-[#005BFF] text-white text-xs font-medium hover:bg-[#0050E6] transition-colors">Принять</button>
                            <button onClick={() => reviewApplication(app.id, false)}
                              className="h-7 px-3 rounded-lg bg-[#EF4444] text-white text-xs font-medium hover:bg-[#DC2626] transition-colors">Отклонить</button>
                          </>
                        ) : (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            app.status === "Approved" ? "bg-[#D1FAE5] text-[#059669]" : "bg-[#FEE2E2] text-[#DC2626]"
                          }`}>
                            {app.status === "Approved" ? "Принят" : "Отклонён"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "schedule" && !selected && <p className="text-sm text-[#9CA3AF]">Выберите курс выше.</p>}

      {/* ══ TAB: TEAMS ════════════════════════════════════════════════════════ */}
      {tab === "teams" && selected && (
        <div className="space-y-5">
          <Card>
            <SectionTitle>Генерация команд</SectionTitle>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label>Занятие</Label>
                <select
                  className={`${INPUT} pr-8 min-w-[240px]`}
                  value={teamsActivityId ?? ""}
                  onChange={e => { if (e.target.value) pickTeamsActivity(e.target.value); else { setTeamsActivityId(null); setTeams([]); } }}
                >
                  <option value="">— выберите занятие —</option>
                  {scheduleActivities.map(a => (
                    <option key={a.id} value={a.id}>М{a.moduleNumber} / {a.typeLabel} / {a.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Размер команды</Label>
                <input className={`${INPUT} w-20`} type="number" min="2" max="10" value={teamSize} onChange={e => setTeamSize(e.target.value)} />
              </div>
              <button onClick={generateTeams} disabled={generating || !teamsActivityId} className={BTN_PRIMARY}>
                {generating ? <><RefreshCw size={14} className="animate-spin" />Генерация...</> : <><Users size={14} />Сгенерировать</>}
              </button>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-2">
              Алгоритм: змейка по списку записанных студентов. Текущие команды для этого занятия будут заменены.
            </p>
          </Card>

          {teamsLoading && <p className="text-sm text-[#6B7280] animate-pulse">Загрузка команд...</p>}

          {!teamsLoading && teams.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teams.map(t => (
                <div key={t.id} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-sm font-semibold text-[#1A1A1B] mb-2">{t.name}</p>
                  <div className="space-y-1">
                    {t.members.map(m => (
                      <div key={m.userId} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#EAF2FF] flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-[#005BFF]">{m.displayName?.[0]?.toUpperCase()}</span>
                        </div>
                        <span className="text-xs text-[#1A1A1B]">{m.displayName}</span>
                      </div>
                    ))}
                    {t.members.length === 0 && <p className="text-xs text-[#9CA3AF]">нет участников</p>}
                  </div>
                  {t.assistants.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#F3F4F6]">
                      {t.assistants.map(a => (
                        <span key={a.assistantId} className="text-xs text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-full">{a.displayName}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!teamsLoading && teamsActivityId && teams.length === 0 && !generating && (
            <p className="text-sm text-[#9CA3AF]">Нет команд для этого занятия. Нажмите «Сгенерировать».</p>
          )}
        </div>
      )}
      {tab === "teams" && !selected && <p className="text-sm text-[#9CA3AF]">Выберите курс выше.</p>}
    </div>
  );
}
