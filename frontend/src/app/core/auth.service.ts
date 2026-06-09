import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { User } from './models';

const TOKEN_KEY = 'jwt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  private _user = signal<User | null>(null);
  private _loading = signal(true);

  user = this._user.asReadonly();
  loading = this._loading.asReadonly();
  isAuth = computed(() => this._user() !== null);
  role = computed(() => this._user()?.role ?? '');
  isTeacher = computed(() => this.role() === 'Teacher' || this.role() === 'Admin');
  isAssistant = computed(() => this.role() === 'Assistant');
  isStudent = computed(() => this.role() === 'Student');

  getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
  setToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
  clearToken() { localStorage.removeItem(TOKEN_KEY); }

  async init(): Promise<void> {
    const token = this.getToken();
    if (!token) { this._loading.set(false); return; }
    try {
      const u = await this.api.me();
      this._user.set(u);
      // Refresh JWT so role claims always reflect current DB state
      const refreshed = await this.api.refreshToken();
      this.setToken(refreshed.accessToken);
    } catch {
      this.clearToken();
    } finally {
      this._loading.set(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const res = await this.api.login(email, password);
    this.setToken(res.accessToken);
    const me = await this.api.me();
    this._user.set(me);
  }

  async register(email: string, password: string, displayName: string): Promise<string> {
    const res = await this.api.register(email, password, displayName);
    this.setToken(res.accessToken);
    const me = await this.api.me();
    this._user.set(me);
    return res.accessToken;
  }

  logout(): void {
    this.clearToken();
    this._user.set(null);
  }
}
