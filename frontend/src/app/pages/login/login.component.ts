import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#005BFF] mb-4">
            <span class="text-white text-xl font-bold">S</span>
          </div>
          <h1 class="text-2xl font-semibold text-[#1A1A1B]">ScoreHub</h1>
          <p class="text-sm text-[#6B7280] mt-1">Войдите в систему</p>
        </div>
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <form (ngSubmit)="submit()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-[#1A1A1B] mb-1.5">Email</label>
              <input type="email" [(ngModel)]="email" name="email" required placeholder="you@example.com"
                class="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-[#1A1A1B] mb-1.5">Пароль</label>
              <input type="password" [(ngModel)]="password" name="password" required placeholder="••••••••"
                class="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"/>
            </div>
            <button type="submit" [disabled]="loading()"
              class="w-full h-10 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] disabled:opacity-60 transition-colors mt-2">
              {{ loading() ? 'Вход...' : 'Войти' }}
            </button>
          </form>
        </div>
        <p class="text-center text-sm text-[#6B7280] mt-4">
          Нет аккаунта?
          <a routerLink="/register" class="text-[#005BFF] hover:underline font-medium ml-1">Зарегистрироваться</a>
        </p>
      </div>
    </div>
  `
})
export class LoginComponent {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  email = ''; password = '';
  loading = signal(false);

  async submit() {
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/']);
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      this.loading.set(false);
    }
  }
}
