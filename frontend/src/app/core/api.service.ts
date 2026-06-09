import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import {
  Course, StudentScore, StudentActivity, Notification, MiniTestDto,
  HelpRequest, TeamSubmission, KtSlot, KtQueueEntry,
  AssistantApplicationDto, TeacherActivity, ActivityTeam, AssistantSession,
  CourseStructure, User, TemplateSummary, TemplateView,
  AssistantOwnApplication, MyTeamDto
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
  enrollCourse(courseId: string) { return this.post<void>(`/api/student/courses/${courseId}/enroll`); }
  courseStructure(courseId: string) { return this.get<CourseStructure>(`/api/teaching/courses/${courseId}/structure`); }

  // Student
  myActivities() { return this.get<StudentActivity[]>('/api/student/activities'); }

  // Notifications
  listNotifications() { return this.get<Notification[]>('/api/notifications'); }
  markNotificationRead(id: string) { return this.post<void>(`/api/notifications/${id}/read`); }

  // Mini-test
  getMiniTest(activityId: string) { return this.get<MiniTestDto>(`/api/activities/${activityId}/mini-test`); }
  submitMiniTest(activityId: string, answers: { questionId: string; selectedOptionIndex: number }[]) {
    return this.post<void>(`/api/activities/${activityId}/mini-test/submit`, { answers });
  }

  // Teams (student)
  requestHelp(teamId: string, message?: string) { return this.post<{ id: string }>(`/api/teams/${teamId}/help-requests`, { message }); }
  markTeamTaskReady(teamId: string, taskItemId: string) { return this.post<void>(`/api/teams/${teamId}/tasks/${taskItemId}/ready`); }

  // Assistant session
  openHelp(activityId: string) { return this.get<HelpRequest[]>(`/api/activities/${activityId}/help-requests`); }
  resolveHelp(helpRequestId: string) { return this.post<void>(`/api/help-requests/${helpRequestId}/resolve`); }
  pendingSubmissions(activityId: string) { return this.get<TeamSubmission[]>(`/api/activities/${activityId}/team-submissions/pending`); }
  startReview(submissionId: string, defenderUserId: string) {
    return this.post<void>(`/api/submissions/${submissionId}/team-review/start`, { defenderUserId });
  }
  completeReview(submissionId: string, accepted: boolean, result01: number) {
    return this.post<void>(`/api/submissions/${submissionId}/team-review/complete`, { accepted, result01 });
  }
  setGroupScore(activityId: string, teamId: string, groupCoefficient: number) {
    return this.post<void>(`/api/activities/${activityId}/teams/${teamId}/group-score`, { groupCoefficient });
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

  // Assistant stats
  mySessions() { return this.get<AssistantSession[]>('/api/assistant/my-sessions'); }
  myApplications() { return this.get<AssistantOwnApplication[]>('/api/assistant/my-applications'); }

  // Team (student)
  myTeam(activityId: string) { return this.get<MyTeamDto>(`/api/activities/${activityId}/my-team`); }

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
  addActivity(moduleId: string, type: number, title: string, startsAt: string, endsAt: string) {
    return this.post<string>(`/api/teaching/modules/${moduleId}/activities`, { type, title, startsAt, endsAt });
  }
  patchMaterials(activityId: string, body: { preLectureVideoUrl?: string; theoryTestUrl?: string; taskFileUrl?: string }) {
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
  applyTemplate(id: string, body: { courseCode: string; courseTitle: string; academicYear: string }) {
    return this.post<{ courseId: string }>(`/api/templates/${id}/apply`, body);
  }

  autoGenerate(activityId: string, teamSize: number) {
    return this.post<{ teamCount: number; studentCount: number; teams: ActivityTeam[] }>(
      `/api/teaching/activities/${activityId}/teams/auto-generate`, { teamSize });
  }
  getTeams(activityId: string) { return this.get<ActivityTeam[]>(`/api/teaching/activities/${activityId}/teams`); }
}
