import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { roleGuard } from './core/guards/role-guard';

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
      // Sin roleGuard — cualquier usuario autenticado ve su propio perfil.
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile-page/profile-page').then(m => m.ProfilePage),
      },

      // --- Plataforma (solo SuperAdmin) ---
      {
        path: 'companies',
        canActivate: [roleGuard('SuperAdmin')],
        loadComponent: () =>
          import('./features/companies/companies-list/companies-list').then(m => m.CompaniesList),
      },
      // 'companies/new' y 'companies/:id' ya no son páginas — alta y detalle por modal desde companies-list.
      {
        path: 'subscriptions/plans',
        canActivate: [roleGuard('SuperAdmin')],
        loadComponent: () =>
          import('./features/subscriptions/plans-list/plans-list').then(m => m.PlansList),
      },
      // 'subscriptions/plans/new' y '/:id/edit' ya no son páginas — alta/edición por modal desde plans-list.
      {
        path: 'subscriptions/active',
        canActivate: [roleGuard('SuperAdmin')],
        loadComponent: () =>
          import('./features/subscriptions/active-subscriptions/active-subscriptions').then(
            m => m.ActiveSubscriptions,
          ),
      },
      {
        path: 'subscriptions/payments',
        canActivate: [roleGuard('SuperAdmin')],
        loadComponent: () =>
          import('./features/subscriptions/payments/payments').then(m => m.Payments),
      },

      // --- Empresa (Fase 2) ---
      {
        path: 'company',
        canActivate: [roleGuard('Admin')],
        loadComponent: () =>
          import('./features/company-profile/company-profile').then(m => m.CompanyProfilePage),
      },
      {
        path: 'team',
        canActivate: [roleGuard('Admin')],
        loadComponent: () => import('./features/team/team-list/team-list').then(m => m.TeamList),
      },
      // 'team/new' antes que 'team/:id' — si no, ':id' la matchea primero.
      {
        path: 'team/new',
        canActivate: [roleGuard('Admin')],
        loadComponent: () => import('./features/team/team-form/team-form').then(m => m.TeamForm),
      },
      {
        path: 'team/:id',
        canActivate: [roleGuard('Admin')],
        loadComponent: () => import('./features/team/team-form/team-form').then(m => m.TeamForm),
      },

      // Productos: List/Get también permite Assistant; Create/Update/Kardex no.
      {
        path: 'inventory/products',
        canActivate: [roleGuard('Admin', 'Warehouse', 'Assistant')],
        loadComponent: () =>
          import('./features/inventory/products-list/products-list').then(m => m.ProductsList),
      },
      // 'inventory/products/new' e 'inventory/products/:id' ya no son páginas — alta y edición por modal desde products-list.
      {
        path: 'inventory/products/:id/kardex',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () =>
          import('./features/inventory/product-kardex/product-kardex').then(m => m.ProductKardexPage),
      },
      // 'inventory/categories/new' e 'inventory/categories/:id' ya no son páginas — alta y edición por modal desde categories-list.
      {
        path: 'inventory/categories',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () =>
          import('./features/inventory/categories-list/categories-list').then(m => m.CategoriesList),
      },
      // 'inventory/units/new' e 'inventory/units/:id' ya no son páginas — alta y edición por modal desde units-list.
      {
        path: 'inventory/units',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () => import('./features/inventory/units-list/units-list').then(m => m.UnitsList),
      },
      {
        path: 'inventory/warehouses',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () =>
          import('./features/inventory/warehouses-list/warehouses-list').then(m => m.WarehousesList),
      },
      // 'inventory/warehouses/new' antes que 'inventory/warehouses/:id'.
      {
        path: 'inventory/warehouses/new',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () =>
          import('./features/inventory/warehouse-form/warehouse-form').then(m => m.WarehouseForm),
      },
      {
        path: 'inventory/warehouses/:id',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () =>
          import('./features/inventory/warehouse-form/warehouse-form').then(m => m.WarehouseForm),
      },
      // 'inventory/movements/new' y '/adjustment' ya no son páginas — se registran por modal desde movements-list.
      {
        path: 'inventory/movements',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () =>
          import('./features/inventory/movements-list/movements-list').then(m => m.MovementsList),
      },

      // --- Fase 3: Compras ---
      // 'purchases/new', 'purchases/suppliers/new', 'purchases/suppliers/:id' y
      // 'purchases/:id/edit' ya no son páginas — alta y edición por modal.
      {
        path: 'purchases',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () =>
          import('./features/purchases/purchases-list/purchases-list').then(m => m.PurchasesList),
      },
      {
        path: 'purchases/suppliers',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () =>
          import('./features/purchases/suppliers-list/suppliers-list').then(m => m.SuppliersList),
      },
      {
        path: 'purchases/:id',
        canActivate: [roleGuard('Admin', 'Warehouse')],
        loadComponent: () =>
          import('./features/purchases/purchase-detail/purchase-detail').then(m => m.PurchaseDetail),
      },
      // --- Fase 4: Ventas ---
      // Ver/crear/editar Pending: Admin, Warehouse, Assistant. Despachar/cancelar
      // se gatea aparte dentro del detalle (Assistant no las ve).
      // 'sales/new' y 'sales/:id/edit' ya no son páginas — alta y edición por modal.
      {
        path: 'sales',
        canActivate: [roleGuard('Admin', 'Warehouse', 'Assistant')],
        loadComponent: () =>
          import('./features/sales/sales-orders-list/sales-orders-list').then(m => m.SalesOrdersList),
      },
      // 'sales/customers/new' e 'sales/customers/:id' ya no son páginas — alta y edición por modal desde customers-list.
      {
        path: 'sales/customers',
        canActivate: [roleGuard('Admin', 'Warehouse', 'Assistant')],
        loadComponent: () =>
          import('./features/sales/customers-list/customers-list').then(m => m.CustomersList),
      },
      {
        path: 'sales/:id',
        canActivate: [roleGuard('Admin', 'Warehouse', 'Assistant')],
        loadComponent: () =>
          import('./features/sales/sales-order-detail/sales-order-detail').then(m => m.SalesOrderDetail),
      },
      // --- Fase 4b: Caja ---
      // Ver pagos: Admin, Warehouse, Assistant. CRUD de métodos: solo Admin.
      {
        path: 'cash/payments',
        canActivate: [roleGuard('Admin', 'Warehouse', 'Assistant')],
        loadComponent: () => import('./features/cash/payments-list/payments-list').then(m => m.PaymentsList),
      },
      {
        path: 'cash/payments/:id',
        canActivate: [roleGuard('Admin', 'Warehouse', 'Assistant')],
        loadComponent: () => import('./features/cash/payment-detail/payment-detail').then(m => m.PaymentDetail),
      },
      // 'cash/methods/new' e 'cash/methods/:id' ya no son páginas — alta y edición por modal desde payment-methods-list.
      {
        path: 'cash/methods',
        canActivate: [roleGuard('Admin')],
        loadComponent: () =>
          import('./features/cash/payment-methods-list/payment-methods-list').then(m => m.PaymentMethodsList),
      },
      // --- Fase 5: Gastos (solo Admin) ---
      // 'expenses/new' e 'expenses/:id/edit' ya no son páginas — alta y edición por modal.
      {
        path: 'expenses',
        canActivate: [roleGuard('Admin')],
        loadComponent: () => import('./features/expenses/expenses-list/expenses-list').then(m => m.ExpensesList),
      },
      {
        path: 'expenses/:id',
        canActivate: [roleGuard('Admin')],
        loadComponent: () =>
          import('./features/expenses/expense-detail/expense-detail').then(m => m.ExpenseDetail),
      },

      {
        path: 'notifications',
        canActivate: [roleGuard('Admin', 'Warehouse', 'Assistant')],
        loadComponent: () =>
          import('./features/notifications/notifications-list/notifications-list').then(m => m.NotificationsList),
      },
    ],
  },
  // Cualquier ruta que no matcheó nada arriba: cae en /dashboard, que ya está
  // detrás de authGuard — sin sesión, termina en /login solo; con sesión,
  // cae en el dashboard en vez de una navegación rota (no había wildcard,
  // así que una URL inexistente antes no resolvía nada).
  { path: '**', redirectTo: 'dashboard' },
];
