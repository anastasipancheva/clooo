# ScoreHub Dev Log
[2026-04-24 10:12:00] init: project scaffold, solution structure
[2026-04-24 11:30:00] init: add .gitignore, README, Dockerfile stub
[2026-04-24 14:05:00] domain: add User entity and UserRole enum
[2026-04-24 16:47:00] frontend: init Angular project, setup tailwind
[2026-04-24 17:22:00] frontend: add base routing and app shell
[2026-04-25 09:40:00] domain: add Course, Module, Activity entities
[2026-04-25 11:15:00] domain: add Team, TeamMember, TaskItem entities
[2026-04-25 13:50:00] frontend: login page component and form
[2026-04-25 15:30:00] frontend: register page, auth service stub
[2026-04-28 10:00:00] infra: EF Core setup, ScoreHubDbContext
[2026-04-28 12:20:00] infra: JWT service implementation
[2026-04-28 14:45:00] frontend: HTTP interceptor for JWT bearer token
[2026-04-28 16:10:00] frontend: auth guard, route protection
[2026-04-29 09:25:00] api: AuthController - register/login endpoints
[2026-04-29 11:40:00] infra: password hashing with BCrypt
[2026-04-29 14:00:00] frontend: dashboard page skeleton
[2026-04-29 16:30:00] frontend: models.ts - TypeScript interfaces for API
[2026-04-30 10:35:00] infra: initial EF migration, database seed
[2026-04-30 13:15:00] api: Program.cs - DI, JWT middleware, CORS
[2026-04-30 15:50:00] frontend: api.service.ts base HTTP layer
[2026-05-04 09:10:00] domain: add AssistantApplication, TaskSubmission
[2026-05-04 11:45:00] infra: AddFullDomainModel migration
[2026-05-04 14:20:00] frontend: courses list page
[2026-05-04 16:55:00] frontend: course card component, enroll button
[2026-05-05 10:05:00] api: CoursesController - CRUD courses
[2026-05-05 12:30:00] infra: AddActivityStatusAndAssistantApps migration
[2026-05-05 15:00:00] frontend: lecture-detail page - task list
[2026-05-05 17:20:00] frontend: notifications page and bell icon
[2026-05-06 09:50:00] api: TeamManagementController - CRUD teams
[2026-05-06 12:00:00] infra: TeachingSetupService - create activities
[2026-05-06 14:35:00] frontend: toast notifications service
[2026-05-07 10:25:00] api: TeachingController - lecture management
[2026-05-07 13:40:00] infra: GroupActivityService - help queue logic
[2026-05-07 16:15:00] frontend: assistant-session page - help requests
[2026-05-08 09:30:00] api: AssistantSessionController - session flow
[2026-05-08 11:55:00] infra: NotificationService - store notifications
[2026-05-08 14:45:00] frontend: assistant-index page - active courses
[2026-05-12 10:10:00] api: ControlPointController - KT endpoints
[2026-05-12 12:40:00] infra: ControlPointService - KT queue logic
[2026-05-12 15:20:00] frontend: kt-detail page - KT student flow
[2026-05-12 17:05:00] frontend: assistant-kt page - KT acceptance flow
[2026-05-13 09:45:00] api: ScoringController - scores CRUD
[2026-05-13 12:10:00] infra: ScoringService - activity score calculation
[2026-05-13 14:50:00] frontend: scores page - student grade view
