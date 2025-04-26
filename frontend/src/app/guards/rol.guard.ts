import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const rolesGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean | UrlTree => {

  const authService = inject(AuthService);
  const router = inject(Router);
  const isAuthenticated = !!authService.getAccessToken();
  const targetUrl = state.url;

  if (targetUrl === '/login' || targetUrl === '/register') {
    if (isAuthenticated) {
      const userRole = authService.getCurrentUserRole();
      const redirectPath = (userRole === 'cliente') ? '/home' : '/product';
      return router.createUrlTree([redirectPath]);
    } else {
      return true;
    }
  }

  if (!isAuthenticated) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: targetUrl } });
  }

  const currentUserRole = authService.getCurrentUserRole();
  const allowedRoles = route.data['roles'] as Array<string>;

  if (!currentUserRole) {
    authService.logout();
    return router.createUrlTree(['/login']);
  }
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }
  if (allowedRoles.includes(currentUserRole)) {
    return true;
  } else {
    const redirectPath = (currentUserRole === 'cliente') ? '/home' : '/product';
    return router.createUrlTree([redirectPath]);
  }
};
