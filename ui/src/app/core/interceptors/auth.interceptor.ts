import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Endpoints that legitimately answer 401 without meaning "your session died". */
const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/public/share/'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      const isPublic = PUBLIC_PATHS.some((path) => req.url.includes(path));

      // An expired or revoked token used to leave the app stuck on error toasts.
      if (err.status === 401 && !isPublic) {
        auth.clearSession();
        router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }

      return throwError(() => err);
    })
  );
};
