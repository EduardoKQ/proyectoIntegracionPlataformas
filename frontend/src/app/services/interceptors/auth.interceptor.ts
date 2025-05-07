import { HttpInterceptorFn,HttpRequest,HttpHandlerFn,HttpEvent,HttpErrorResponse} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { AuthService, RefreshTokenResponse } from '../auth.service';
import { Router } from '@angular/router';

let isRefreshingToken = false;
let tokenRefreshed$ = new BehaviorSubject<boolean | null>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  const authService = inject(AuthService);
  const router = inject(Router);
  const accessToken = authService.getAccessToken();

  const urlsToExclude = [
    '/api/user/login',
    '/api/user/register-client',
    '/api/user/token-refresh'
  ];

  const shouldExclude = urlsToExclude.some(url => req.url.includes(url));
  let authReq = req;

  if (accessToken && !shouldExclude) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !shouldExclude) {
        return handle401Error(authReq, next, authService, router);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(
  originalRequest: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router
): Observable<HttpEvent<unknown>> {

  if (!isRefreshingToken) {
    isRefreshingToken = true;
    tokenRefreshed$.next(null);

    return authService.refreshToken().pipe(
      switchMap((refreshTokenResponse: RefreshTokenResponse) => {
        isRefreshingToken = false;
        tokenRefreshed$.next(true);
        const newRequest = originalRequest.clone({
          setHeaders: {
            Authorization: `Bearer ${refreshTokenResponse.access}`
          }
        });
        return next(newRequest);
      }),
      catchError((refreshError) => {
        isRefreshingToken = false;
        tokenRefreshed$.next(false);
        console.error('handle401Error: Falló el refresco del token.', refreshError);
        authService.logout();
        router.navigate(['/login']);
        return throwError(() => refreshError);
      })
    );
  } else {
    return tokenRefreshed$.pipe(
      filter(refreshed => refreshed !== null),
      take(1),
      switchMap(refreshed => {
        if (refreshed) {
          const newAccessToken = authService.getAccessToken();
          if (newAccessToken) {
            const newRequest = originalRequest.clone({
              setHeaders: {
                Authorization: `Bearer ${newAccessToken}`
              }
            });
            return next(newRequest);
          } else {
            authService.logout();
            router.navigate(['/login']);
            return throwError(() => new Error('No se encontró el nuevo token de acceso después del refresco.'));
          }
        } else {
           authService.logout();
           router.navigate(['/login']);
          return throwError(() => new Error('Fallo en el refresco de token, sesión terminada.'));
        }
      })
    );
  }
}
