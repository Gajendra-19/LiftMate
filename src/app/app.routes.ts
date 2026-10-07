import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/guards/auth.guards';
import { Carrier } from './features/customer/carrier/carrier';
import { Dashboard } from './features/customer/dashboard/dashboard';
import { Landing } from './features/landing/landing';
import { Login } from './features/auth/login/login';
import { NotFound } from './not-found/not-found';
import { ProviderDashboard } from './provider-dashboard/provider-dashboard';
import { Signup } from './features/auth/signup/signup';

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
