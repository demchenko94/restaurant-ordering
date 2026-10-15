import type { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'menu' },
  {
    path: 'menu',
    title: 'Menu · Restaurant Ordering',
    loadComponent: () => import('@restaurant/web/feature-ordering').then((m) => m.CatalogPage),
  },
  {
    path: 'orders',
    title: 'Orders · Restaurant Ordering',
    loadComponent: () => import('@restaurant/web/feature-orders').then((m) => m.OrdersPage),
  },
  {
    path: 'setup',
    title: 'Setup · Restaurant Ordering',
    loadComponent: () => import('@restaurant/web/feature-setup').then((m) => m.SetupPage),
  },
  {
    path: '**',
    title: 'Not found · Restaurant Ordering',
    loadComponent: () => import('./shell/not-found.component').then((m) => m.NotFoundComponent),
  },
];
