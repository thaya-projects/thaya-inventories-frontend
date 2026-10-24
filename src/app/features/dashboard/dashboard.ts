import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { CompaniesService } from '../../core/services/companies';
import { DashboardService } from '../../core/services/dashboard';
import { AuthService } from '../../core/services/auth';
import { Company, CreateCompanyResponse } from '../../core/models/company.model';
import { DashboardResponse } from '../../core/models/dashboard.model';
import { CompanyCreateModal } from '../companies/company-create-modal/company-create-modal';
import { ToastService } from '../../shared/toast/toast.service';

const TRIAL_WARNING_DAYS = 7;

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, StatCard, CompanyCreateModal],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private companiesService = inject(CompaniesService);
  private dashboardService = inject(DashboardService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  showCreateModal = signal(false);

  role = computed(() => this.auth.currentUser()?.role);
  isSuperAdmin = computed(() => this.role() === 'SuperAdmin');
  // "Admin" acá es el admin de una empresa — distinto de SuperAdmin.
  isCompanyAdmin = computed(() => this.role() === 'Admin');
  isWarehouse = computed(() => this.role() === 'Warehouse');
  isAssistant = computed(() => this.role() === 'Assistant');

  loading = signal(true);
  errorMessage = signal<string | null>(null);

  // --- SuperAdmin ---
  private companies = signal<Company[]>([]);

  activeCount = computed(() => this.companies().filter(c => c.isActive).length);

  trialsExpiringCount = computed(() => {
    const now = Date.now();
    const limit = now + TRIAL_WARNING_DAYS * 24 * 60 * 60 * 1000;

    return this.companies().filter(c => {
      if (!c.trialEndsAt) return false;
      const endsAt = new Date(c.trialEndsAt).getTime();
      return endsAt >= now && endsAt <= limit;
    }).length;
  });

  pastDueCount = computed(() =>
    this.companies().filter(c => {
      const status = c.subscriptionStatus?.toLowerCase().replace(/_/g, '') ?? '';
      return status.includes('pastdue') || status.includes('expired');
    }).length,
  );

  // --- Empresa (Admin / Warehouse / Assistant) ---
  dashboard = signal<DashboardResponse | null>(null);

  // Por rol: qué tarjetas y listas mostrar, y a dónde va cada una.
  showSalesAmountCards = computed(() => this.isCompanyAdmin() || this.isAssistant());
  showPayablesCard = computed(() => this.isCompanyAdmin());
  showLowStockCard = computed(() => this.isCompanyAdmin() || this.isWarehouse());
  showReceiveCard = computed(() => this.isWarehouse());
  showMovementsLink = computed(() => this.isWarehouse());

  showLowStockList = computed(() => this.isCompanyAdmin() || this.isWarehouse());
  showReceiveList = computed(() => this.isCompanyAdmin() || this.isWarehouse());
  showDispatchList = computed(() => true);
  showPaymentsList = computed(() => this.isCompanyAdmin() || this.isAssistant());

  // "Inicio con botones gordos" (prompt UX Admin): hasta 4 acciones grandes
  // según rol, en vez de un solo CTA chico arriba a la derecha. Admin ve las
  // 4 (está en ambos grupos); Assistant/Warehouse ven solo lo suyo.
  quickActions = computed<{ label: string; route: string; queryParams?: Record<string, string>; tone: 'primary' | 'warning' }[]>(() => {
    const actions: { label: string; route: string; queryParams?: Record<string, string>; tone: 'primary' | 'warning' }[] = [];

    if (this.isCompanyAdmin() || this.isAssistant()) {
      actions.push({ label: 'Nueva venta', route: '/sales/new', tone: 'primary' });
      actions.push({
        label: 'Por cobrar',
        route: '/cash/payments',
        queryParams: { sourceType: 'SalesOrder', status: 'Pending' },
        tone: 'warning',
      });
    }
    if (this.isCompanyAdmin() || this.isWarehouse()) {
      // "Nueva compra", no "nueva entrada" — una entrada de movimiento queda
      // bloqueada si la empresa usa multi-almacén (ver movement-form-modal),
      // compras siempre funciona. Ya no es página — abre por modal desde
      // purchases-list (ver ?new=true).
      actions.push({ label: 'Nueva compra', route: '/purchases', queryParams: { new: 'true' }, tone: 'primary' });
      actions.push({ label: 'Stock bajo', route: '/inventory/products', tone: 'warning' });
    }

    return actions;
  });

  constructor() {
    if (this.isSuperAdmin()) {
      this.loadSuperAdmin();
    } else if (this.role()) {
      this.loadCompany();
    } else {
      this.loading.set(false);
    }
  }

  openCreateModal() {
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  onCompanyCreated(res: CreateCompanyResponse) {
    this.showCreateModal.set(false);
    this.toast.success(`Empresa "${res.companyName}" creada.`);
    // 'companies/:id' ya no es página — el detalle es un modal desde
    // companies-list, abierto vía ?view=<id>.
    this.router.navigate(['/companies'], { queryParams: { view: res.companyId } });
  }

  private loadSuperAdmin() {
    this.loading.set(true);

    // TODO: no hay un endpoint de estadísticas de plataforma todavía — traemos
    // un lote grande de empresas y calculamos los conteos acá. Reemplazar por
    // un endpoint dedicado (ej. GET /platform/dashboard) cuando exista.
    this.companiesService.list(1, 1000).subscribe({
      next: result => {
        this.companies.set(result.items);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los datos del dashboard.');
        this.loading.set(false);
      },
    });
  }

  private loadCompany() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.dashboardService.get().subscribe({
      next: dashboard => {
        this.dashboard.set(dashboard);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el dashboard.');
        this.loading.set(false);
      },
    });
  }
}
