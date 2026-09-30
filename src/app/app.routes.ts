import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, Routes, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { Carrier } from './carrier/carrier';
import { Dashboard } from './dashboard/dashboard';
import { Landing } from './landing/landing';
import { Login } from './Login/login';
import { NotFound } from './not-found/not-found';
import { ProviderDashboard } from './provider-dashboard/provider-dashboard';
import { Signup } from './signup/signup';

const roleGuard = (role: 'customer' | 'worker'): CanActivateFn => (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return (role === 'customer' ? authService.isCustomer() : authService.isWorker())
    ? true
    : router.parseUrl(authService.homeUrl());
};

const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  return authService.isLoggedIn() ? inject(Router).parseUrl(authService.homeUrl()) : true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: Landing, canActivate: [guestGuard] },
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'signup', component: Signup, canActivate: [guestGuard] },
  { path: 'carrier', component: Carrier, canActivate: [roleGuard('customer')] },
  { path: 'provider', component: ProviderDashboard, canActivate: [roleGuard('worker')] },
  {
    path: 'dashboard',
    children: [
      { path: '', pathMatch: 'full', component: Dashboard, canActivate: [roleGuard('customer')] },
      { path: 'carrier', component: Carrier, canActivate: [roleGuard('customer')] },
      { path: 'provider', component: ProviderDashboard, canActivate: [roleGuard('worker')] },
    ],
  },
  { path: 'not-found', component: NotFound },
  { path: '**', redirectTo: 'not-found' },
];
