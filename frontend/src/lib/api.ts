const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5062";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jwt");
}

export function setToken(token: string) {
  localStorage.setItem("jwt", token);
}

export function clearToken() {
  localStorage.removeItem("jwt");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.error ?? msg;
    } catch {}
    throw new Error(msg);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

// ── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  login: (email: string, password: string) =>
    post<{ accessToken: string; userId: string; displayName: string; email: string; roles: string[] }>("/api/auth/login", { email, password }),
  register: (email: string, password: string, displayName: string) =>
    post<{ accessToken: string; userId: string; displayName: string; email: string; roles: string[] }>("/api/auth/register", { email, password, displayName }),
  me: () => get<{ id: string; email: string; displayName: string; role: string }>("/api/auth/me"),
};

// ── Courses ──────────────────────────────────────────────────────────────────
export const courses = {
  list: () => get<Course[]>("/api/courses"),
  scores: (courseId: string) => get<StudentScore[]>(`/api/courses/${courseId}/scores`),
  studentScore: (courseId: string, studentId: string) =>
    get<StudentScore>(`/api/courses/${courseId}/students/${studentId}/score`),
  patchGrading: (courseId: string, body: { ktMultiplierMapJson?: string; finalGradingTableJson?: string }) =>
    patch(`/api/teaching/courses/${courseId}/grading-config`, body),
  students: (courseId: string) =>
    get<{ id: string; email: string; displayName: string; role: string; enrolledAt: string }[]>(`/api/courses/${courseId}/students`),
  enroll: (courseId: string) => post(`/api/courses/${courseId}/enroll`),
  structure: (courseId: string) => get<CourseStructure>(`/api/teaching/courses/${courseId}/structure`),
};

// ── Activities ───────────────────────────────────────────────────────────────
export const activities = {
  patchConfig: (activityId: string, body: {
    preLectureVideoUrl?: string;
    lectureBasePoints?: number;
    miniTestMaxBonus?: number;
    miniTestDurationSeconds?: number;
  }) => patch(`/api/teaching/activities/${activityId}/config`, body),
  setActiveAssistants: (activityId: string, ids: string[]) =>
    put(`/api/teaching/activities/${activityId}/active-assistants`, { ids }),
};

// ── MiniTest ─────────────────────────────────────────────────────────────────
export const miniTest = {
  get: (activityId: string) => get<MiniTestDto>(`/api/activities/${activityId}/mini-test`),
  publish: (activityId: string) => post(`/api/activities/${activityId}/mini-test/publish`),
  submit: (activityId: string, answers: { questionId: string; selectedOptionIndex: number }[]) =>
    post(`/api/activities/${activityId}/mini-test/submit`, { answers }),
  addQuestion: (activityId: string, q: { order: number; text: string; options: string[]; correctOptionIndex: number }) =>
    post<{ id: string }>(`/api/activities/${activityId}/mini-test/questions`, q),
  deleteQuestion: (activityId: string, questionId: string) =>
    del(`/api/activities/${activityId}/mini-test/questions/${questionId}`),
};

// ── Teams (student) ──────────────────────────────────────────────────────────
export const teams = {
  requestHelp: (teamId: string, message?: string) =>
    post<{ id: string }>(`/api/teams/${teamId}/help-requests`, { message }),
  markReady: (teamId: string, taskItemId: string) =>
    post(`/api/teams/${teamId}/tasks/${taskItemId}/ready`),
};

// ── Assistant session ────────────────────────────────────────────────────────
export const assistantSession = {
  openHelp: (activityId: string) =>
    get<HelpRequest[]>(`/api/activities/${activityId}/help-requests`),
  resolveHelp: (helpRequestId: string) =>
    post(`/api/help-requests/${helpRequestId}/resolve`),
  pendingSubmissions: (activityId: string) =>
    get<TeamSubmission[]>(`/api/activities/${activityId}/team-submissions/pending`),
  startReview: (submissionId: string, defenderUserId: string) =>
    post(`/api/submissions/${submissionId}/team-review/start`, { defenderUserId }),
  completeReview: (submissionId: string, accepted: boolean, result01: number, defenderCoefficient?: number) =>
    post(`/api/submissions/${submissionId}/team-review/complete`, { accepted, result01, defenderCoefficient }),
  setGroupScore: (activityId: string, teamId: string, groupCoefficient: number) =>
    post(`/api/activities/${activityId}/teams/${teamId}/group-score`, { groupCoefficient }),
};

// ── Control Point ────────────────────────────────────────────────────────────
export const kt = {
  markReady: (activityId: string, taskItemId: string) =>
    post(`/api/activities/${activityId}/kt/tasks/${taskItemId}/ready`),
  myQueue: (activityId: string) =>
    get<KtSlot[]>(`/api/activities/${activityId}/kt/my-queue`),
  queue: (activityId: string, taskItemId: string) =>
    get<KtQueueEntry[]>(`/api/activities/${activityId}/kt/tasks/${taskItemId}/queue`),
  callNext: (activityId: string, taskItemId: string) =>
    post(`/api/activities/${activityId}/kt/tasks/${taskItemId}/call-next`),
  completeReview: (activityId: string, submissionId: string, accepted: boolean, result01: number) =>
    post(`/api/activities/${activityId}/kt/submissions/${submissionId}/review/complete`, { accepted, result01 }),
  finalize: (activityId: string) =>
    post(`/api/activities/${activityId}/kt/finalize`),
};

// ── Homework ─────────────────────────────────────────────────────────────────
export const homework = {
  submit: (body: { activityId: string; taskItemId: string; documentUrl: string; memberUserIds: string[] }) =>
    post<{ id: string }>("/api/homework/submissions", body),
  queue: (activityId: string) =>
    get<HwQueueRow[]>(`/api/activities/${activityId}/homework-queue`),
  startReview: (submissionId: string) =>
    post(`/api/homework/submissions/${submissionId}/review/start`),
  completeReview: (submissionId: string, accepted: boolean) =>
    post(`/api/homework/submissions/${submissionId}/review/complete`, { accepted }),
  backToQueue: (submissionId: string) =>
    post(`/api/homework/submissions/${submissionId}/review/back-to-queue`),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = {
  list: () => get<Notification[]>("/api/notifications"),
  markRead: (id: string) => post(`/api/notifications/${id}/read`),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const admin = {
  listUsers: () => get<{ id: string; email: string; displayName: string; role: string }[]>("/api/admin/users"),
  setUserRole: (userId: string, roleName: string) =>
    post(`/api/admin/users/${userId}/roles`, { roleName }),
};

// ── Teaching setup ────────────────────────────────────────────────────────────
export const teaching = {
  createCourse: (code: string, title: string, academicYear: string) =>
    post<string>("/api/teaching/courses", { code, title, academicYear }),
  deleteCourse: (courseId: string) =>
    del(`/api/teaching/courses/${courseId}`),
  addModule: (courseId: string, number: number, title: string, startsAt: string, endsAt: string) =>
    post<string>(`/api/teaching/courses/${courseId}/modules`, { number, title, startsAt, endsAt }),
  deleteModule: (moduleId: string) =>
    del(`/api/teaching/modules/${moduleId}`),
  addActivity: (moduleId: string, type: number, title: string, startsAt: string, endsAt: string) =>
    post<string>(`/api/teaching/modules/${moduleId}/activities`, { type, title, startsAt, endsAt }),
  addTaskSet: (activityId: string, title: string) =>
    post<string>(`/api/teaching/activities/${activityId}/task-sets`, { title }),
  addTask: (taskSetId: string, code: string, title: string, statement: string | null, points: number) =>
    post<string>(`/api/teaching/task-sets/${taskSetId}/tasks`, { code, title, statement, points }),
  setTaskAssistants: (taskId: string, ids: string[]) =>
    put(`/api/teaching/tasks/${taskId}/assistants`, { ids }),
  createTeam: (activityId: string, name: string) =>
    post<string>(`/api/teaching/activities/${activityId}/teams`, { name }),
  setTeamMembers: (teamId: string, ids: string[]) =>
    put(`/api/teaching/teams/${teamId}/members`, { ids }),
  setTeamAssistants: (teamId: string, ids: string[]) =>
    put(`/api/teaching/teams/${teamId}/assistant-links`, { ids }),
  autoGenerate: (activityId: string, teamSize: number) =>
    post<{ teamCount: number; studentCount: number; teams: ActivityTeam[] }>(`/api/teaching/activities/${activityId}/teams/auto-generate`, { teamSize }),
  getTeams: (activityId: string) =>
    get<ActivityTeam[]>(`/api/teaching/activities/${activityId}/teams`),
  patchMaterials: (activityId: string, body: { preLectureVideoUrl?: string; theoryTestUrl?: string; taskFileUrl?: string }) =>
    patch(`/api/teaching/activities/${activityId}/materials`, body),
  swapMembers: (activityId: string, studentAId: string, studentBId: string) =>
    put(`/api/teaching/activities/${activityId}/teams/swap-member`, { studentAId, studentBId }),
  setUserRole: (userId: string, roleName: string) =>
    post(`/api/admin/users/${userId}/roles`, { roleName }),
};

// ── Student activities ────────────────────────────────────────────────────────
export const studentApi = {
  myActivities: () => get<StudentActivity[]>("/api/student/activities"),
  enroll: (courseId: string) => post(`/api/student/courses/${courseId}/enroll`),
};

// ── Assistant stats ───────────────────────────────────────────────────────────
export const assistantStats = {
  mySessions: () => get<AssistantSession[]>("/api/assistant/my-sessions"),
};

// ── Assistant applications ────────────────────────────────────────────────────
export const assistantApps = {
  list: (activityId: string) => get<AssistantApplicationDto[]>(`/api/activities/${activityId}/assistant-applications`),
  apply: (activityId: string, message?: string) =>
    post(`/api/activities/${activityId}/assistant-applications`, { message: message ?? null }),
  review: (activityId: string, appId: string, approved: boolean) =>
    put(`/api/activities/${activityId}/assistant-applications/${appId}/review`, { approved }),
};

// ── KT enhancements ───────────────────────────────────────────────────────────
export const ktApi = {
  ...kt,
  unmarkReady: (activityId: string, taskItemId: string) =>
    del(`/api/activities/${activityId}/kt/tasks/${taskItemId}/ready`),
  setSolution: (activityId: string, taskItemId: string, url: string) =>
    patch(`/api/activities/${activityId}/kt/tasks/${taskItemId}/solution`, { url }),
  getSubmissions: (activityId: string, taskItemId: string) =>
    get<KtStudentSubmission[]>(`/api/activities/${activityId}/kt/tasks/${taskItemId}/submissions`),
  getAllTasks: (activityId: string) =>
    get<KtSlot[]>(`/api/activities/${activityId}/kt/tasks`),
};

// ── Teaching enhancements ─────────────────────────────────────────────────────
export const teachingApi = {
  ...teaching,
  startActivity: (activityId: string) => post<{ theoryTestUrl?: string | null }>(`/api/teaching/activities/${activityId}/start`),
  finishActivity: (activityId: string) => post(`/api/teaching/activities/${activityId}/finish`),
  enrollBulk: (courseId: string, emails: string[]) =>
    post<{ added: number; notFound: number }>(`/api/teaching/courses/${courseId}/enroll-bulk`, { emails }),
  getCourseActivities: (courseId: string) =>
    get<TeacherActivity[]>(`/api/teaching/courses/${courseId}/activities`),
  getCourseStudents: (courseId: string) =>
    get<{ id: string; email: string; displayName: string; role: string; enrolledAt: string }[]>(`/api/courses/${courseId}/students`),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Course {
  id: string;
  code: string;
  title: string;
  academicYear: string;
}

export interface MiniTestDto {
  activityId: string;
  isOpen: boolean;
  secondsRemaining: number;
  questions: { id: string; order: number; text: string; options: string[] }[];
}

export interface HelpRequest {
  id: string;
  teamId: string;
  teamName: string;
  createdByUserId: string;
  createdAt: string;
  message?: string;
}

export interface TeamSubmission {
  submissionId: string;
  teamId: string;
  teamName: string;
  taskItemId: string;
  taskCode: string;
  status: string;
  readyAt?: string;
  reviewerId?: string;
  defenderUserId?: string;
}

export interface KtSlot {
  taskItemId: string;
  taskCode: string;
  status: string;
  queuePosition: number;
  readyAt?: string;
}

export interface KtQueueEntry {
  submissionId: string;
  studentId: string;
  studentEmail: string;
  readyAt?: string;
  status: string;
}

export interface HwQueueRow {
  submissionId: string;
  taskItemId: string;
  taskCode: string;
  taskTitle: string;
  memberIds: string[];
  submittedAt: string;
  status: string;
  timeCoefficient: number;
  priority: number;
  documentUrl: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  createdAt: string;
  readAt?: string;
}

export interface CourseTask {
  id: string;
  code: string;
  title: string;
  points: number;
}

export interface CourseTaskSet {
  id: string;
  title: string;
  published: boolean;
  tasks: CourseTask[];
}

export interface CourseActivity {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  preLectureVideoUrl?: string;
  theoryTestUrl?: string;
  taskFileUrl?: string;
  status: string;
  taskSets: CourseTaskSet[];
}

export interface CourseModule {
  id: string;
  number: number;
  title: string;
  startsAt: string;
  endsAt: string;
  activities: CourseActivity[];
}

export interface CourseStructure {
  id: string;
  code: string;
  title: string;
  academicYear: string;
  modules: CourseModule[];
}

export interface StudentScore {
  studentId: string;
  displayName: string;
  modules: { moduleNumber: number; lecturePoints: number; homeworkPoints: number; ktMultiplier: number; moduleScore: number }[];
  finalScore: number;
  mark: string;
}

export interface StudentActivity {
  id: string;
  title: string;
  type: number;
  typeLabel: string;
  status: string;
  startsAt: string;
  endsAt: string;
  courseCode: string;
  courseTitle: string;
  moduleTitle: string;
}

export interface AssistantApplicationDto {
  id: string;
  assistantId: string;
  assistantName: string;
  assistantEmail: string;
  status: string;
  message?: string;
  appliedAt: string;
  reviewedAt?: string;
}

export interface TeacherActivity {
  id: string;
  title: string;
  type: number;
  typeLabel: string;
  status: string;
  startsAt: string;
  endsAt: string;
  preLectureVideoUrl?: string;
  theoryTestUrl?: string;
  taskFileUrl?: string;
  moduleTitle: string;
  moduleNumber: number;
  moduleId: string;
}

export interface ActivityTeam {
  id: string;
  name: string;
  members: { userId: string; displayName: string; isAbsent: boolean }[];
  assistants: { assistantId: string; displayName: string }[];
}

export interface AssistantSession {
  id: string;
  activityId: string;
  activityTitle: string;
  activityType: string;
  activityStatus: string;
  activityStartsAt: string;
  moduleId: string;
  moduleNumber: number;
  moduleTitle: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
}

export interface KtStudentSubmission {
  id: string;
  studentId: string;
  solutionUrl?: string;
  status: string;
  readyAt?: string;
  result01?: number;
}
