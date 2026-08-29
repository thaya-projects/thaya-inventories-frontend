import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';

export const routes: Routes = [
  // Sin sesión: authGuard rebota /dashboard hacia /login.
  // Con sesión: guestGuard rebota /login hacia /dashboard.
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard),
      },
      {
        path: 'companies',
        loadComponent: () =>
          import('./features/companies/companies-list/companies-list').then(m => m.CompaniesList),
      },
      // 'companies/new' antes que 'companies/:id' — si no, ':id' la matchea primero.
      {
        path: 'companies/new',
        loadComponent: () =>
          import('./features/companies/company-form/company-form').then(m => m.CompanyForm),
      },
      {
        path: 'companies/:id',
        loadComponent: () =>
          import('./features/companies/company-detail/company-detail').then(m => m.CompanyDetail),
      },
      {
        path: 'subscriptions/plans',
        loadComponent: () =>
          import('./features/subscriptions/plans-list/plans-list').then(m => m.PlansList),
      },
      {
        path: 'subscriptions/plans/new',
        loadComponent: () =>
          import('./features/subscriptions/plan-form/plan-form').then(m => m.PlanForm),
      },
      {
        path: 'subscriptions/plans/:id/edit',
        loadComponent: () =>
          import('./features/subscriptions/plan-form/plan-form').then(m => m.PlanForm),
      },
      {
        path: 'subscriptions/active',
        loadComponent: () =>
          import('./features/subscriptions/active-subscriptions/active-subscriptions').then(
            m => m.ActiveSubscriptions,
          ),
      },
      {
        path: 'subscriptions/payments',
        loadComponent: () =>
          import('./features/subscriptions/payments/payments').then(m => m.Payments),
      },
    ],
  },
];
