import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BalanceItem, BalancesResponse, BalancesService } from '../../../core/services/balances';

type Mode = 'receivables' | 'payables';

const MONEY = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DAY = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short' });

// Días a partir de los cuales una deuda se marca como "atrasada".
const OVERDUE_DAYS = 30;

const COPY: Record<Mode, { title: string; intro: string; totalLabel: string; action: string; empty: string; emptyHint: string }> = {
  receivables: {
    title: 'Por cobrar',
    intro: 'Lo que tus clientes todavía te deben. Las ventas más antiguas aparecen primero.',
    totalLabel: 'Te deben en total',
    action: 'Registrar cobro',
    empty: 'Nadie te debe nada.',
    emptyHint: 'Todas tus ventas están cobradas. Si vendes a crédito o con pago parcial, lo que falte cobrar aparecerá aquí.',
  },
  payables: {
    title: 'Por pagar',
    intro: 'Lo que debes a proveedores y los gastos que aún no pagaste. Lo más antiguo aparece primero.',
    totalLabel: 'Debes en total',
    action: 'Registrar pago',
    empty: 'No tienes deudas pendientes.',
    emptyHint: 'Todas tus compras y gastos están pagados. Lo que quede pendiente aparecerá aquí.',
  },
};

@Component({
  selector: 'app-balances-page',
  imports: [RouterLink],
  templateUrl: './balances-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalancesPage {
  private route = inject(ActivatedRoute);
  private balancesService = inject(BalancesService);

  mode: Mode = this.route.snapshot.data['mode'] === 'payables' ? 'payables' : 'receivables';
  copy = COPY[this.mode];
  overdueDays = OVERDUE_DAYS;

  loading = signal(true);
  errorMessage = signal<string | null>(null);
  data = signal<BalancesResponse | null>(null);

  overdueCount = computed(() => this.data()?.items.filter(i => i.daysOutstanding >= OVERDUE_DAYS).length ?? 0);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.errorMessage.set(null);
    const request = this.mode === 'payables' ? this.balancesService.payables() : this.balancesService.receivables();
    request.subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la lista.');
        this.loading.set(false);
      },
    });
  }

  money(value: number): string {
    return 'Bs ' + MONEY.format(value);
  }

  day(iso: string): string {
    // DateOnly llega como "2026-11-01": se arma en hora local para no correr un día.
    const [y, m, d] = iso.split('-').map(Number);
    return DAY.format(new Date(y, m - 1, d));
  }

  age(days: number): string {
    if (days === 0) return 'hoy';
    if (days === 1) return 'hace 1 día';
    return `hace ${days} días`;
  }

  paidPercent(item: BalanceItem): number {
    return item.total > 0 ? Math.round((item.paid / item.total) * 100) : 0;
  }

  // A dónde ir para registrar el cobro/pago de ese documento.
  link(item: BalanceItem): { route: unknown[]; queryParams: Record<string, string> | null } {
    switch (item.sourceType) {
      case 'SalesOrder':
        return { route: ['/sales'], queryParams: { view: item.sourceId } };
      case 'Purchase':
        return { route: ['/purchases'], queryParams: { view: item.sourceId } };
      default:
        return { route: ['/expenses', item.sourceId], queryParams: null };
    }
  }

  title(item: BalanceItem): string {
    return item.partyName ?? item.label;
  }

  subtitle(item: BalanceItem): string {
    const ref = item.partyName ? item.label : item.sourceType === 'Expense' ? 'Gasto' : item.label;
    return `${ref} · ${this.day(item.date)} · ${this.age(item.daysOutstanding)}`;
  }
}
