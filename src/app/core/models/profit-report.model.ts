// Confirmado con GET /api/reports/profit. Rol: Admin, Warehouse, Assistant.
export type ProfitReportGroupBy = 'day' | 'week' | 'month';

export interface ProfitReportSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  // null cuando no hubo ingresos en el período — no se puede calcular el margen.
  grossMarginPercent: number | null;
  expenses: number;
  netProfit: number;
  netMarginPercent: number | null;
}

export interface ProfitReportSeriesPoint {
  label: string;
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

// Plata que entró/salió de verdad (pagos Paid, por PaidAt) — distinto de
// "summary", que es margen real y solo cuenta lo ya vendido.
export interface ProfitReportCashFlow {
  collectedFromSales: number;
  paidForPurchases: number;
  paidForExpenses: number;
  paidForLabor: number;
  netCashFlow: number;
}

export interface ProfitByProduct {
  productId: string;
  code: string;
  name: string;
  quantitySold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number | null;
}

export interface ProfitReport {
  from: string;
  to: string;
  groupBy: ProfitReportGroupBy;
  summary: ProfitReportSummary;
  cashFlow: ProfitReportCashFlow;
  series: ProfitReportSeriesPoint[];
  byProduct: ProfitByProduct[];
}
