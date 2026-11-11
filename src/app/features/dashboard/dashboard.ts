import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { StatCard } from '../../shared/stat-card/stat-card';
import { CompaniesService } from '../../core/services/companies';
import { DashboardService } from '../../core/services/dashboard';
import { AuthService } from '../../core/services/auth';
import { Company, CreateCompanyResponse } from '../../core/models/company.model';
import { DashboardResponse } from '../../core/models/dashboard.model';
import { CompanyCreateModal } from '../companies/company-create-modal/company-create-modal';
import { CompanyContextService } from '../../core/services/company-context';
import { ToastService } from '../../shared/toast/toast.service';
import { InfoHint } from '../../shared/info-hint/info-hint';
import { DashboardLowStockItem } from '../../core/models/dashboard.model';

// Qué mide cada indicador del Inicio (ícono "i").
const KPI_HINTS = {
  salesToday: 'Total vendido hoy y cantidad de ventas registradas desde las 00:00.',
  salesMonth: 'Total vendido en el mes en curso, desde el día 1 hasta hoy.',
  receivables: 'Lo que tus clientes todavía te deben: ventas a crédito o con pago parcial. Solo aparece cuando alguien te debe.',
  payables: 'Lo que debes a proveedores y gastos que aún no pagaste. Solo aparece cuando tienes algo pendiente.',
  lowStock: 'Productos que controlan stock y llegaron a su stock mínimo o se agotaron. Conviene reponerlos.',
  dispatch: 'Ventas registradas que todavía no se entregaron al cliente.',
  receive: 'Compras hechas a proveedores que todavía no ingresaron al almacén.',
} as const;

const PAYMENT_TIME = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type DashboardSection = 'low' | 'dispatch' | 'receive' | 'payments';

// Prioridad: también es el orden en móvil.
const SECTION_ORDER: DashboardSection[] = ['low', 'dispatch', 'receive', 'payments'];

const MONEY = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TRIAL_WARNING_DAYS = 7;

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, NgTemplateOutlet, StatCard, CompanyCreateModal, InfoHint],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private companiesService = inject(CompaniesService);
  private dashboardService = inject(DashboardService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private companyContext = inject(CompanyContextService);
  // Fábrica: "por despachar". Tienda: la venta directa ya sale vendida; aquí quedan envíos y pedidos sin stock.
  isFactory = computed(() => this.companyContext.company()?.settings?.usesProduction === true);

  showCreateModal = signal(false);
  hints = KPI_HINTS;

  firstName = computed(() => (this.auth.currentUser()?.fullName ?? '').trim().split(/\s+/)[0] || '');

  greeting = computed(() => {
    const hour = new Date().getHours();
    const base = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    return this.firstName() ? `${base}, ${this.firstName()}` : base;
  });

  // Resumen de una línea de lo urgente, para que se lea sin recorrer las tarjetas.
  pendingSummary = computed(() => {
    const d = this.dashboard();
    if (!d) return '';
    const parts: string[] = [];
    if (this.showLowStockCard() && d.kpis.lowStockCount > 0)
      parts.push(`${d.kpis.lowStockCount} producto${d.kpis.lowStockCount === 1 ? '' : 's'} con stock bajo`);
    if (d.kpis.salesPendingDispatchCount > 0)
      parts.push(`${d.kpis.salesPendingDispatchCount} venta${d.kpis.salesPendingDispatchCount === 1 ? '' : 's'} ${this.isFactory() ? 'por despachar' : 'por entregar'}`);
    if (this.showReceiveList() && d.kpis.purchasesPendingCount > 0)
      parts.push(`${d.kpis.purchasesPendingCount} compra${d.kpis.purchasesPendingCount === 1 ? '' : 's'} por recibir`);
    return parts.length ? `Tienes ${parts.join(', ')}.` : 'Todo al día. No hay pendientes urgentes.';
  });

  money(value: number | null | undefined): string {
    return 'Bs ' + MONEY.format(value ?? 0);
  }

  // Parte entera y decimales por separado: los centavos van en tono menor
  // para que la cifra se lea de un vistazo.
  moneyParts(value: number | null | undefined): { whole: string; cents: string } {
    const [whole, cents = '00'] = MONEY.format(value ?? 0).split(',');
    return { whole, cents };
  }

  // Por cobrar / por pagar solo aparecen cuando hay saldo: en negocios que
  // cobran y pagan al contado, ver "Bs 0,00" todos los días es ruido.
  showReceivables = computed(() => this.showSalesAmountCards() && (this.dashboard()?.kpis.receivablesAmount ?? 0) > 0);
  showPayables = computed(() => this.showPayablesCard() && (this.dashboard()?.kpis.payablesAmount ?? 0) > 0);

  outOfStockCount = computed(() => this.dashboard()?.lowStock.filter(i => i.stockStatus === 'OutOfStock').length ?? 0);

  paymentTime(iso: string): string {
    return PAYMENT_TIME.format(new Date(iso));
  }

  // Iniciales para el avatar de cliente/proveedor ("Colegio La Salle" → "CL").
  initials(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/\s+/).filter(w => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w));
    const letters = (words.length ? words : [(name ?? '?').trim()]).slice(0, 2).map(w => w.charAt(0).toUpperCase());
    return letters.join('') || '?';
  }

  // --- Reparto de secciones en dos columnas ---------------------------------
  // Alto estimado en px (encabezado + filas) a partir de los datos reales;
  // alcanza para decidir el reparto, no necesita medir el DOM.
  private sectionHeight(key: DashboardSection): number {
    const d = this.dashboard();
    if (!d) return 0;
    const header = 62;
    const empty = 72;
    const rows = { low: d.lowStock.length, dispatch: d.pendingDispatch.length, receive: d.pendingReceive.length, payments: d.recentPayments.length }[key];
    const rowHeight = key === 'low' ? 69 : 61;
    return header + (rows === 0 ? empty : rows * rowHeight);
  }

  private visibleSections = computed<DashboardSection[]>(() =>
    SECTION_ORDER.filter(key => ({
      low: this.showLowStockList(),
      dispatch: this.showDispatchList(),
      receive: this.showReceiveList(),
      payments: this.showPaymentsList(),
    })[key]),
  );

  // Prueba todos los repartos posibles (son 4 secciones como mucho) y se queda
  // con el que deja las dos columnas más parejas. Dentro de cada columna se
  // respeta el orden de prioridad; ante empate, lo prioritario va a la izquierda.
  sectionColumns = computed<DashboardSection[][]>(() => {
    const sections = this.visibleSections();
    if (sections.length <= 1) return [sections];

    let best: DashboardSection[][] = [sections, []];
    let bestScore = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 1 << sections.length; mask++) {
      if (!(mask & 1)) continue; // la primera sección siempre arranca a la izquierda
      const left = sections.filter((_, i) => mask & (1 << i));
      const right = sections.filter((_, i) => !(mask & (1 << i)));
      if (right.length === 0) continue;
      const lh = left.reduce((sum, k) => sum + this.sectionHeight(k) + 24, 0);
      const rh = right.reduce((sum, k) => sum + this.sectionHeight(k) + 24, 0);
      const score = Math.max(lh, rh) + Math.abs(lh - rh) * 0.01;
      if (score < bestScore) {
        bestScore = score;
        best = [left, right];
      }
    }
    return best;
  });

  sectionPriority(key: DashboardSection): number {
    return SECTION_ORDER.indexOf(key);
  }

  retry() {
    this.loadCompany();
  }

  // Porcentaje del mínimo cubierto, para la barrita de nivel (tope 100%).
  stockLevel(item: DashboardLowStockItem): number {
    if (item.minimumStock <= 0) return item.currentStock > 0 ? 100 : 0;
    return Math.max(0, Math.min(100, Math.round((item.currentStock / item.minimumStock) * 100)));
  }

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
  // Almacén ya no ve ventas: los despachos pendientes son de Admin y Ventas.
  showDispatchList = computed(() => this.isCompanyAdmin() || this.isAssistant());
  showPaymentsList = computed(() => this.isCompanyAdmin() || this.isAssistant());

  // "Inicio con botones gordos" (prompt UX Admin): hasta 4 acciones grandes
  // según rol, en vez de un solo CTA chico arriba a la derecha. Admin ve las
  // 4 (está en ambos grupos); Assistant/Warehouse ven solo lo suyo.
  quickActions = computed<{ label: string; route: string; queryParams?: Record<string, string>; tone: 'primary' | 'warning' }[]>(() => {
    const actions: { label: string; route: string; queryParams?: Record<string, string>; tone: 'primary' | 'warning' }[] = [];

    if (this.isCompanyAdmin() || this.isAssistant()) {
      actions.push({ label: 'Nueva venta', route: '/sales/new', tone: 'primary' });
    }
    if (this.isCompanyAdmin() || this.isWarehouse()) {
      // "Nueva compra", no "nueva entrada" — una entrada de movimiento queda
      // bloqueada si la empresa usa multi-almacén (ver movement-form-modal),
      // compras siempre funciona. Ya no es página — abre por modal desde
      // purchases-list (ver ?new=true).
      actions.push({ label: 'Nueva compra', route: '/purchases', queryParams: { new: 'true' }, tone: 'primary' });
    }
    // Una acción real en lugar de "Por cobrar" (que ya está en la franja de
    // dinero y ahora solo aparece si alguien debe).
    if (this.isCompanyAdmin()) {
      actions.push({ label: 'Nuevo gasto', route: '/expenses', queryParams: { new: 'true' }, tone: 'primary' });
    }
    if (this.isCompanyAdmin() || this.isWarehouse()) {
      actions.push({ label: 'Stock bajo', route: '/inventory/products', queryParams: { stock: 'low' }, tone: 'warning' });
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
