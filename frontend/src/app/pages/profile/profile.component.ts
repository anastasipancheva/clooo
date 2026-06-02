import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

const ROLE_LABEL: Record<string, string> = {
  Student: 'Студент', Assistant: 'Ассистент', Teacher: 'Преподаватель',
};
const ROLE_COLOR: Record<string, string> = {
  Student: 'bg-[#F3F4F6] text-[#6B7280]',
  Assistant: 'bg-[#FEF3C7] text-[#D97706]',
  Teacher: 'bg-[#EAF2FF] text-[#005BFF]',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  template: `
    @if (user) {
      <div class="max-w-md space-y-5">
        <h1 class="text-lg font-semibold text-[#1A1A1B]">Профиль</h1>

        <div class="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div class="bg-[#EAF2FF] px-6 py-8 flex items-center gap-4">
            <div class="w-14 h-14 rounded-full bg-[#005BFF] flex items-center justify-center flex-shrink-0">
              <span class="text-white text-xl font-bold">{{ user.displayName[0].toUpperCase() }}</span>
            </div>
            <div>
              <p class="text-base font-semibold text-[#1A1A1B]">{{ user.displayName }}</p>
              <span class="text-xs font-medium px-2.5 py-0.5 rounded-full" [class]="roleColor(user.role)">
                {{ roleLabel(user.role) }}
              </span>
            </div>
          </div>

          <div class="divide-y divide-[#F3F4F6]">
            <div class="flex items-center gap-3 px-5 py-3.5">
              <span class="text-[#9CA3AF] flex-shrink-0">✉</span>
              <div>
                <p class="text-xs text-[#9CA3AF]">Email</p>
                <p class="text-sm text-[#1A1A1B]">{{ user.email }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3 px-5 py-3.5">
              <span class="text-[#9CA3AF] flex-shrink-0">🛡</span>
              <div>
                <p class="text-xs text-[#9CA3AF]">Роль</p>
                <p class="text-sm text-[#1A1A1B]">{{ roleLabel(user.role) }}</p>
              </div>
            </div>

            <div class="flex items-center justify-between px-5 py-3.5">
              <div class="flex items-center gap-3">
                <span class="text-[#9CA3AF] flex-shrink-0">👤</span>
                <div>
                  <p class="text-xs text-[#9CA3AF]">ID пользователя</p>
                  <p class="text-xs font-mono text-[#6B7280] break-all">{{ user.id }}</p>
                </div>
              </div>
              <button (click)="copyId()"
                class="ml-3 w-8 h-8 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#005BFF] hover:bg-[#EAF2FF] transition-colors flex-shrink-0"
                title="Скопировать ID">
                📋
              </button>
            </div>
          </div>
        </div>

        <button (click)="logout()"
          class="flex items-center gap-2 h-10 px-5 rounded-xl border border-[#E5E7EB] text-sm text-[#EF4444] hover:bg-red-50 hover:border-red-200 transition-colors">
          🚪 Выйти из аккаунта
        </button>
      </div>
    }
  `
})
export class ProfileComponent {
  auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  get user() { return this.auth.user(); }

  roleLabel(role: string) { return ROLE_LABEL[role] ?? role; }
  roleColor(role: string) { return ROLE_COLOR[role] ?? 'bg-[#F3F4F6] text-[#6B7280]'; }

  copyId() {
    const id = this.user?.id;
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => this.toast.success('ID скопирован'));
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
