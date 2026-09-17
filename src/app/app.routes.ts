import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, Routes } from '@angular/router';
import { AuthService } from './auth.service';
import { Carrier } from './carrier/carrier';
import { Dashboard } from './dashboard/dashboard';
import { Landing } from './landing/landing';
import { Login } from './Login/login';
import { ProviderDashboard } from './provider-dashboard/provider-dashboard';
import { Signup } from './signup/signup';

const authGuard = (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return (
    authService.isLoggedIn() ||
    router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
  );
};

const landingGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.isLoggedIn() ? router.createUrlTree(['/dashboard']) : true;
};

export const routes: Routes = [
  { path: '', component: Landing, canActivate: [landingGuard] },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'carrier', redirectTo: 'dashboard/carrier' },
  { path: 'provider', redirectTo: 'dashboard/provider' },
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard],
    children: [
      { path: 'carrier', component: Carrier },
      { path: 'provider', component: ProviderDashboard },
    ],
  },
  { path: '**', redirectTo: '' },
];
