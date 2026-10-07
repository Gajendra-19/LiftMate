import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const roleGuard = (role: 'customer' | 'worker'): CanActivateFn => (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return (role === 'customer' ? authService.isCustomer() : authService.isWorker())
    ? true
    : router.parseUrl(authService.homeUrl());
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  return authService.isLoggedIn() ? inject(Router).parseUrl(authService.homeUrl()) : true;
};
