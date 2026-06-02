export interface Course { id: string; code: string; title: string; academicYear: string; isEnrolled?: boolean; }

export interface StudentScore {
  studentId: string; displayName: string;
  modules: { moduleNumber: number; lecturePoints: number; homeworkPoints: number; ktMultiplier: number; moduleScore: number }[];
  finalScore: number; mark: string;
}

export interface StudentActivity {
  id: string; title: string; type: number; typeLabel: string; status: string;
  startsAt: string; endsAt: string; courseCode: string; courseTitle: string; moduleTitle: string;
}

export interface Notification { id: string; type: string; title: string; body?: string; createdAt: string; readAt?: string; }

export interface MiniTestDto {
  activityId: string; isOpen: boolean; secondsRemaining: number;
  questions: { id: string; order: number; text: string; options: string[] }[];
}

export interface HelpRequest {
  id: string; teamId: string; teamName: string; createdByUserId: string; createdAt: string; message?: string;
}

export interface TeamSubmission {
  submissionId: string; teamId: string; teamName: string; taskItemId: string; taskCode: string;
  status: string; readyAt?: string; reviewerId?: string; defenderUserId?: string;
}

export interface KtSlot {
  taskItemId: string; taskCode: string; status: string; queuePosition: number; readyAt?: string; solutionUrl?: string;
}

export interface KtQueueEntry {
  submissionId: string; studentId: string; studentEmail: string; readyAt?: string; status: string;
}

export interface AssistantApplicationDto {
  id: string; assistantId: string; assistantName: string; assistantEmail: string;
  status: string; message?: string; appliedAt: string; reviewedAt?: string;
}

export interface TeacherActivity {
  id: string; title: string; type: number; typeLabel: string; status: string;
  startsAt: string; endsAt: string; preLectureVideoUrl?: string; theoryTestUrl?: string; taskFileUrl?: string;
  moduleTitle: string; moduleNumber: number; moduleId: string;
}

export interface ActivityTeam {
  id: string; name: string;
  members: { userId: string; displayName: string; isAbsent: boolean }[];
  assistants: { assistantId: string; displayName: string }[];
}

export interface AssistantSession {
  id: string; activityId: string; activityTitle: string; activityType: string; activityStatus: string;
  activityStartsAt: string; moduleId: string; moduleNumber: number; moduleTitle: string;
  courseId: string; courseCode: string; courseTitle: string;
}

export interface CourseModule {
  id: string; number: number; title: string; startsAt: string; endsAt: string;
  activities: CourseActivity[];
}

export interface CourseActivity {
  id: string; title: string; type: string; startsAt: string; endsAt: string;
  preLectureVideoUrl?: string; theoryTestUrl?: string; taskFileUrl?: string;
  status: string; taskSets: CourseTaskSet[];
}

export interface CourseTaskSet { id: string; title: string; published: boolean; tasks: CourseTask[]; }
export interface CourseTask { id: string; code: string; title: string; points: number; }

export interface CourseStructure {
  id: string; code: string; title: string; academicYear: string; modules: CourseModule[];
}

export interface User {
  id: string; email: string; displayName: string;
  role: 'Student' | 'Assistant' | 'Teacher' | 'Admin';
}

export interface NotificationPayload { type: string; title: string; body?: string; createdAt: string; }

export interface AssistantOwnApplication {
  id: string; activityId: string; activityTitle: string; activityStatus: string;
  status: string; message?: string; appliedAt: string; reviewedAt?: string;
  moduleTitle: string; courseCode: string;
}

export interface MyTeamDto {
  id: string; name: string;
  tasks: { id: string; code: string; title: string; points: number; status: string }[];
}

// ── Course Templates ──────────────────────────────────────────────────────────
export interface TemplateSummary {
  id: string; title: string; description?: string;
  moduleCount: number; activityCount: number; createdAt: string;
}
export interface TemplateTaskView   { id: string; code: string; title: string; points: number; }
export interface TemplateActivityView {
  id: string; type: number; title: string; taskFileUrl?: string; theoryTestUrl?: string;
  tasks: TemplateTaskView[];
}
export interface TemplateModuleView { id: string; number: number; title: string; activities: TemplateActivityView[]; startsAt?: string; endsAt?: string; }
export interface TemplateView {
  id: string; title: string; description?: string; createdAt: string;
  modules: TemplateModuleView[];
}
