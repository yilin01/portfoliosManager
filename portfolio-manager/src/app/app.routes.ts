import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
    },
    {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
    },
    {
        path: 'portfolios',
        loadComponent: () => import('./features/portfolios/portfolio-list/portfolio-list.component').then(m => m.PortfolioListComponent)
    },
    {
        path: 'portfolios/:id',
        loadComponent: () => import('./features/portfolios/portfolio-detail/portfolio-detail.component').then(m => m.PortfolioDetailComponent)
    },
    {
        path: 'retirement',
        loadComponent: () => import('./features/retirement/retirement-list/retirement-list.component').then(m => m.RetirementListComponent)
    },
    {
        path: 'retirement/:id',
        loadComponent: () => import('./features/retirement/retirement-detail/retirement-detail.component').then(m => m.RetirementDetailComponent)
    },
    {
        path: 'bank-accounts',
        loadComponent: () => import('./features/bank-accounts/bank-account-list/bank-account-list.component').then(m => m.BankAccountListComponent)
    },
    {
        path: '**',
        redirectTo: 'dashboard'
    }
];
