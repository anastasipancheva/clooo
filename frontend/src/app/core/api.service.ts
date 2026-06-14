import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import {
  Course, StudentScore, StudentActivity, Notification, MiniTestDto,
  HelpRequest, TeamSubmission, KtSlot, KtQueueEntry,
  AssistantApplicationDto, TeacherActivity, ActivityTeam, AssistantSession,
  CourseStructure, User, TemplateSummary, TemplateView,
  AssistantOwnApplication
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private get<T>(path: string) { return firstValueFrom(this.http.get<T>(`${this.base}${path}`)); }
  private post<T>(path: string, body?: unknown) { return firstValueFrom(this.http.post<T>(`${this.base}${path}`, body)); }
  private put<T>(path: string, body?: unknown) { return firstValueFrom(this.http.put<T>(`${this.base}${path}`, body)); }
  private patch<T>(path: string, body?: unknown) { return firstValueFrom(this.http.patch<T>(`${this.base}${path}`, body)); }
  private delete<T>(path: string) { return firstValueFrom(this.http.delete<T>(`${this.base}${path}`)); }

  // Auth
  login(email: string, password: string) {
    return this.post<{ accessToken: string; userId: string; displayName: string; email: string; roles: string[] }>
      ('/api/auth/login', { email, password });
  }
  register(email: string, password: string, displayName: string) {
    return this.post<{ accessToken: string; userId: string; displayName: string; email: string; roles: string[] }>
      ('/api/auth/register', { email, password, displayName });
  }
  me() { return this.get<User>('/api/auth/me'); }
  refreshToken() { return this.post<{ accessToken: string; expiresAtUtc: string; role: string }>('/api/auth/refresh'); }

  // Courses
  listCourses() { return this.get<Course[]>('/api/courses'); }
  courseScores(courseId: string) { return this.get<StudentScore[]>(`/api/courses/${courseId}/scores`); }
  courseStudents(courseId: string) {
    return this.get<{ id: string; email: string; displayName: string; role: string; enrolledAt: string }[]>
      (`/api/courses/${courseId}/students`);
  }
  enrollCourse(courseId: string, inviteCode: string) {
    return this.post<void>(`/api/student/courses/${courseId}/enroll`, { inviteCode });
  }
  getCourseByInvite(code: string) {
    return this.get<{ id: string; code: string; title: string; academicYear: string }>(`/api/courses/by-invite/${code}`);
  }
  getCourseInvite(courseId: string) {
    return this.get<{ inviteCode: string }>(`/api/teaching/courses/${courseId}/invite`);
  }
  regenerateCourseInvite(courseId: string) {
    return this.post<{ inviteCode: string }>(`/api/teaching/courses/${courseId}/invite/regenerate`);
  }
  courseStructure(courseId: string) { return this.get<CourseStructure>(`/api/teaching/courses/${courseId}/structure`); }

  // Student
  myActivities() { return this.get<StudentActivity[]>('/api/student/activities'); }
  calendar() { return this.get<StudentActivity[]>('/api/student/calendar'); }

  // Notifications
  listNotifications() { return this.get<Notification[]>('/api/notifications'); }
  markNotificationRead(id: string) { return this.post<void>(`/api/notifications/${id}/read`); }

  // Mini-test
  getMiniTest(activityId: string) { return this.get<MiniTestDto>(`/api/activities/${activityId}/mini-test`); }
  submitMiniTest(activityId: string, answers: { questionId: string; selectedOptionIndex: number }[]) {
    return this.post<void>(`/api/activities/${activityId}/mini-test/submit`, { answers });
  }

  // Teams (student)
  getMyTeam(activityId: string) {
    return this.get<{
      teamId: string; teamName: string;
      tasks: { id: string; code: string; status: string }[];
      activityTitle?: string; activityStatus?: string;
      preLectureVideoUrl?: string | null; theoryTestUrl?: string | null; taskFileUrl?: string | null;
      taskCount?: number; assistantName?: string | null;
    }>(`/api/activities/${activityId}/my-team`);
  }
  requestHelp(teamId: string, message?: string) { return this.post<{ id: string }>(`/api/teams/${teamId}/help-requests`, { message }); }
  markTeamTaskReady(teamId: string, taskItemId: string) { return this.post<void>(`/api/teams/${teamId}/tasks/${taskItemId}/ready`); }
  markTeamTaskReadyByNumber(teamId: string, taskNumber: number) { return this.post<void>(`/api/teams/${teamId}/tasks/by-number/${taskNumber}/ready`); }

  // Assistant session
  openHelp(activityId: string) { return this.get<HelpRequest[]>(`/api/activities/${activityId}/help-requests`); }
  resolveHelp(helpRequestId: string) { return this.post<void>(`/api/help-requests/${helpRequestId}/resolve`); }
  pendingSubmissions(activityId: string) { return this.get<TeamSubmission[]>(`/api/activities/${activityId}/team-submissions/pending`); }
  startReview(submissionId: string, defenderUserId: string) {
    return this.post<void>(`/api/submissions/${submissionId}/team-review/start`, { defenderUserId });
  }
  completeReview(submissionId: string, accepted: boolean, result01: number, defenderCoefficient?: number) {
    return this.post<void>(`/api/submissions/${submissionId}/team-review/complete`, { accepted, result01, defenderCoefficient });
  }
  // Attendance (assistant)
  attendanceList(activityId: string) {
    return this.get<{ teamId: string; teamName: string; members: { userId: string; displayName: string; isAbsent: boolean }[] }[]>(
      `/api/activities/${activityId}/attendance`);
  }
  setAttendance(teamId: string, memberUserId: string, isAbsent: boolean) {
    return this.post<void>(`/api/teams/${teamId}/members/${memberUserId}/attendance`, { isAbsent });
  }

  // KT (assistant)
  ktQueue(activityId: string, taskItemId: string) {
    return this.get<KtQueueEntry[]>(`/api/activities/${activityId}/kt/tasks/${taskItemId}/queue`);
  }
  ktCallNext(activityId: string, taskItemId: string) {
    return this.post<void>(`/api/activities/${activityId}/kt/tasks/${taskItemId}/call-next`);
  }
  ktCompleteReview(activityId: string, submissionId: string, accepted: boolean, result01: number) {
    return this.post<void>(`/api/activities/${activityId}/kt/submissions/${submissionId}/review/complete`, { accepted, result01 });
  }

  // KT (student)
  ktAllTasks(activityId: string) { return this.get<KtSlot[]>(`/api/activities/${activityId}/kt/tasks`); }
  ktMarkReady(activityId: string, taskItemId: string) { return this.post<void>(`/api/activities/${activityId}/kt/tasks/${taskItemId}/ready`); }
  ktUnmarkReady(activityId: string, taskItemId: string) { return this.delete<void>(`/api/activities/${activityId}/kt/tasks/${taskItemId}/ready`); }
  ktSetSolution(activityId: string, taskItemId: string, url: string) {
    return this.patch<void>(`/api/activities/${activityId}/kt/tasks/${taskItemId}/solution`, { url });
  }

  // Homework
  submitHomework(body: { activityId: string; taskItemId: string; documentUrl: string; memberUserIds: string[] }) {
    return this.post<{ id: string }>('/api/homework/submissions', body);
  }

  // Assistant applications
  applyAssistant(activityId: string, message?: string) {
    return this.post<void>(`/api/activities/${activityId}/assistant-applications`, { message: message ?? null });
  }
  listApplications(activityId: string) {
    return this.get<AssistantApplicationDto[]>(`/api/activities/${activityId}/assistant-applications`);
  }
  reviewApplication(activityId: string, appId: string, approved: boolean) {
    return this.put<void>(`/api/activities/${activityId}/assistant-applications/${appId}/review`, { approved });
  }
  cancelApplication(activityId: string) {
    return this.delete<void>(`/api/activities/${activityId}/assistant-applications/mine`);
  }

  // Assistant stats
  mySessions() { return this.get<AssistantSession[]>('/api/assistant/my-sessions'); }
  myApplications() { return this.get<AssistantOwnApplication[]>('/api/assistant/my-applications'); }

  // Admin
  listAllUsers() { return this.get<{ id: string; email: string; displayName: string; role: string }[]>('/api/admin/users'); }
  setUserRole(userId: string, roleName: string) { return this.post<void>(`/api/admin/users/${userId}/roles`, { roleName }); }

  // Teaching
  createCourse(code: string, title: string, academicYear: string) {
    return this.post<string>('/api/teaching/courses', { code, title, academicYear });
  }
  deleteCourse(courseId: string) { return this.delete<void>(`/api/teaching/courses/${courseId}`); }
  addModule(courseId: string, number: number, title: string, startsAt: string, endsAt: string) {
    return this.post<string>(`/api/teaching/courses/${courseId}/modules`, { number, title, startsAt, endsAt });
  }
  deleteModule(moduleId: string) { return this.delete<void>(`/api/teaching/modules/${moduleId}`); }
  patchModule(moduleId: string, body: { title?: string; startsAt?: string; endsAt?: string }) {
    return this.patch<void>(`/api/teaching/modules/${moduleId}`, body);
  }
  addActivity(moduleId: string, type: number, title: string, startsAt: string, endsAt: string) {
    return this.post<string>(`/api/teaching/modules/${moduleId}/activities`, { type, title, startsAt, endsAt });
  }
  patchActivity(activityId: string, body: { title?: string; startsAt?: string; endsAt?: string }) {
    return this.patch<void>(`/api/teaching/activities/${activityId}`, body);
  }
  patchMaterials(activityId: string, body: { preLectureVideoUrl?: string; theoryTestUrl?: string; taskFileUrl?: string; taskCount?: number }) {
    return this.patch<void>(`/api/teaching/activities/${activityId}/materials`, body);
  }
  startActivity(activityId: string) {
    return this.post<{ theoryTestUrl?: string | null }>(`/api/teaching/activities/${activityId}/start`);
  }
  finishActivity(activityId: string) { return this.post<void>(`/api/teaching/activities/${activityId}/finish`); }
  enrollBulk(courseId: string, emails: string[]) {
    return this.post<{ added: number; notFound: number }>(`/api/teaching/courses/${courseId}/enroll-bulk`, { emails });
  }
  getCourseActivities(courseId: string) { return this.get<TeacherActivity[]>(`/api/teaching/courses/${courseId}/activities`); }
  // Course Templates
  listTemplates() { return this.get<TemplateSummary[]>('/api/templates'); }
  getTemplate(id: string) { return this.get<TemplateView>(`/api/templates/${id}`); }
  createTemplate(body: object) { return this.post<{ id: string }>('/api/templates', body); }
  deleteTemplate(id: string) { return this.delete<void>(`/api/templates/${id}`); }
  applyTemplate(id: string, body: { courseCode: string; courseTitle: string; academicYear: string; startDate?: string }) {
    return this.post<{ courseId: string }>(`/api/templates/${id}/apply`, body);
  }
  saveAsTemplate(courseId: string, body: { title?: string; description?: string }) {
    return this.post<{ id: string }>(`/api/teaching/courses/${courseId}/save-as-template`, body);
  }

  autoGenerate(activityId: string, teamSize: number) {
    return this.post<{ teamCount: number; studentCount: number; teams: ActivityTeam[] }>(
      `/api/teaching/activities/${activityId}/teams/auto-generate`, { teamSize });
  }
  getTeams(activityId: string) { return this.get<ActivityTeam[]>(`/api/teaching/activities/${activityId}/teams`); }
  createTeam(activityId: string, name: string) { return this.post<string>(`/api/teaching/activities/${activityId}/teams`, { name }); }
  setTeamMembers(teamId: string, ids: string[]) { return this.put<void>(`/api/teaching/teams/${teamId}/members`, { ids }); }
  setTeamAssistants(teamId: string, ids: string[]) { return this.put<void>(`/api/teaching/teams/${teamId}/assistant-links`, { ids }); }
  // Approved assistants for an activity (for assigning to teams)
  approvedAssistants(activityId: string) {
    return this.get<AssistantApplicationDto[]>(`/api/activities/${activityId}/assistant-applications`);
  }
}
