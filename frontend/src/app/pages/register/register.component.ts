import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-register',
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
          <p class="text-sm text-[#6B7280] mt-1">Создайте аккаунт</p>
        </div>
        <div class="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <form (ngSubmit)="submit()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-[#1A1A1B] mb-1.5">Имя</label>
              <input type="text" [(ngModel)]="displayName" name="displayName" required placeholder="Иван Иванов"
                class="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-[#1A1A1B] mb-1.5">Email</label>
              <input type="email" [(ngModel)]="email" name="email" required placeholder="you@example.com"
                class="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-[#1A1A1B] mb-1.5">Пароль</label>
              <input type="password" [(ngModel)]="password" name="password" required placeholder="••••••••"
                class="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"/>
              <p class="text-xs text-[#9CA3AF] mt-1">Минимум 8 символов</p>
            </div>
            <button type="submit" [disabled]="loading()"
              class="w-full h-10 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] disabled:opacity-60 transition-colors mt-2">
              {{ loading() ? 'Регистрация...' : 'Зарегистрироваться' }}
            </button>
          </form>
        </div>
        <p class="text-center text-sm text-[#6B7280] mt-4">
          Уже есть аккаунт?
          <a routerLink="/login" class="text-[#005BFF] hover:underline font-medium ml-1">Войти</a>
        </p>
      </div>
    </div>
  `
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  displayName = ''; email = ''; password = '';
  loading = signal(false);

  async submit() {
    if (this.password.length < 8) { this.toast.error('Пароль должен быть не менее 8 символов'); return; }
    this.loading.set(true);
    try {
      await this.auth.register(this.email, this.password, this.displayName);
      this.toast.success('Аккаунт создан! Запишитесь на курс.');
      this.router.navigate(['/courses']);
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Ошибка регистрации');
    } finally {
      this.loading.set(false);
    }
  }
}
