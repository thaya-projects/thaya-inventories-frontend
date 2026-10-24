import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StatCard, StatCardTone } from '../../../shared/stat-card/stat-card';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { ReportsService } from '../../../core/services/reports';
import {
  ProfitByProduct,
  ProfitReport,
  ProfitReportGroupBy,
  ProfitReportSeriesPoint,
} from '../../../core/models/profit-report.model';

type ReportTab = 'profit' | 'cashFlow';

const GROUP_BY_OPTIONS: { value: ProfitReportGroupBy; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
];

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

@Component({
  selector: 'app-profit-report',
  imports: [FormsModule, StatCard, DataTable],
  templateUrl: './profit-report.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfitReportPage {
  private reportsService = inject(ReportsService);

  groupByOptions = GROUP_BY_OPTIONS;

  activeTab = signal<ReportTab>('profit');

  from = signal(toDateInput(firstDayOfMonth()));
  to = signal(toDateInput(new Date()));
  groupBy = signal<ProfitReportGroupBy>('day');

  loading = signal(true);
  errorMessage = signal<string | null>(null);
  report = signal<ProfitReport | null>(null);

  hoveredIndex = signal<number | null>(null);
  hoveredPoint = computed(() => {
    const i = this.hoveredIndex();
    const series = this.report()?.series ?? [];
    return i != null ? (series[i] ?? null) : null;
  });

  // Barra más alta en valor absoluto — define la escala del gráfico divergente.
  private maxAbsNetProfit = computed(() => {
    const points = this.report()?.series ?? [];
    return Math.max(1, ...points.map(p => Math.abs(p.netProfit)));
  });

  netProfitTone = computed<StatCardTone>(() => ((this.report()?.summary.netProfit ?? 0) >= 0 ? 'success' : 'danger'));
  grossProfitTone = computed<StatCardTone>(() =>
    (this.report()?.summary.grossProfit ?? 0) >= 0 ? 'success' : 'danger',
  );
  netCashFlowTone = computed<StatCardTone>(() => ((this.report()?.cashFlow.netCashFlow ?? 0) >= 0 ? 'success' : 'danger'));

  // Barras horizontales de entradas/salidas de caja, todas a la misma escala.
  private maxCashFlowAmount = computed(() => {
    const cf = this.report()?.cashFlow;
    if (!cf) return 1;
    return Math.max(1, cf.collectedFromSales, cf.paidForPurchases, cf.paidForExpenses, cf.paidForLabor);
  });

  cashFlowBars = computed(() => {
    const cf = this.report()?.cashFlow;
    if (!cf) return [];
    return [
      { label: 'Cobrado de ventas', value: cf.collectedFromSales, colorClass: 'bg-gr-success' },
      { label: 'Pagado a proveedores', value: cf.paidForPurchases, colorClass: 'bg-gr-warning' },
      { label: 'Pagado en gastos', value: cf.paidForExpenses, colorClass: 'bg-gr-danger' },
      { label: 'Pagado en planilla', value: cf.paidForLabor, colorClass: 'bg-gr-warning' },
    ];
  });

  cashFlowBarWidth(value: number): number {
    return Math.min(100, (value / this.maxCashFlowAmount()) * 100);
  }

  private revenueTpl = viewChild.required<TemplateRef<{ $implicit: ProfitByProduct }>>('revenueTpl');
  private cogsTpl = viewChild.required<TemplateRef<{ $implicit: ProfitByProduct }>>('cogsTpl');
  private grossProfitTpl = viewChild.required<TemplateRef<{ $implicit: ProfitByProduct }>>('grossProfitTpl');
  private marginTpl = viewChild.required<TemplateRef<{ $implicit: ProfitByProduct }>>('marginTpl');

  byProductColumns = computed<DataTableColumn<ProfitByProduct>[]>(() => [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'quantitySold', label: 'Cant. vendida', align: 'right' },
    { key: 'revenue', label: 'Ingresos', align: 'right', cellTemplate: this.revenueTpl() },
    { key: 'cogs', label: 'Costo', align: 'right', cellTemplate: this.cogsTpl() },
    { key: 'grossProfit', label: 'Utilidad bruta', align: 'right', cellTemplate: this.grossProfitTpl() },
    { key: 'marginPercent', label: 'Margen', align: 'right', cellTemplate: this.marginTpl() },
  ]);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.reportsService.getProfit(this.from(), this.to(), this.groupBy()).subscribe({
      next: report => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el reporte de rentabilidad.');
        this.loading.set(false);
      },
    });
  }

  barHeightPercent(point: ProfitReportSeriesPoint): number {
    return Math.min(100, (Math.abs(point.netProfit) / this.maxAbsNetProfit()) * 100);
  }
}
