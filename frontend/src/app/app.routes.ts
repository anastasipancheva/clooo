import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  // Guest routes
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
  },

  // Protected routes inside Shell
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'courses',
        loadComponent: () => import('./pages/courses/courses.component').then(m => m.CoursesComponent),
      },
      {
        path: 'scores',
        loadComponent: () => import('./pages/scores/scores.component').then(m => m.ScoresComponent),
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'homework',
        loadComponent: () => import('./pages/homework/homework.component').then(m => m.HomeworkComponent),
      },
      {
        path: 'lecture/:id',
        loadComponent: () => import('./pages/lecture-detail/lecture-detail.component').then(m => m.LectureDetailComponent),
      },
      {
        path: 'kt/:id',
        loadComponent: () => import('./pages/kt-detail/kt-detail.component').then(m => m.KtDetailComponent),
      },
      {
        path: 'assistant',
        loadComponent: () => import('./pages/assistant-index/assistant-index.component').then(m => m.AssistantIndexComponent),
      },
      {
        path: 'assistant/session/:id',
        loadComponent: () => import('./pages/assistant-session/assistant-session.component').then(m => m.AssistantSessionComponent),
      },
      {
        path: 'assistant/kt/:id',
        loadComponent: () => import('./pages/assistant-kt/assistant-kt.component').then(m => m.AssistantKtComponent),
      },
      {
        path: 'admin',
        loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
      },
    ],
  },

  // Fallback
  { path: '**', redirectTo: '' },
];
