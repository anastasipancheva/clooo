import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Бэкенд возвращает { error: "текст" }. Пробрасываем понятное сообщение,
      // чтобы компоненты (catch e instanceof Error ? e.message) показывали причину.
      const body: unknown = err?.error;
      const msg =
        (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
          ? (body as { error: string }).error
          : null) ??
        (typeof body === 'string' && body.length > 0 ? body : null) ??
        err?.message ??
        'Ошибка';
      return throwError(() => new Error(msg));
    })
  );
};
