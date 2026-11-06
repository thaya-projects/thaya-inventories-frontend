import { StockStatus } from './product.model';

// Confirmado con GET /api/dashboard. Roles: Admin, Warehouse, Assistant —
// mismo payload para los 3, sin diferencias en el backend (el filtrado de
// tarjetas/listas por rol es decisión del frontend).
// from/to solo afectan salesMonthAmount y expensesMonthAmount.
// receivablesAmount y payablesAmount son saldos de siempre (una deuda no vence
// con el mes) y coinciden con /dashboard/receivables y /dashboard/payables.
// El resto de kpis y las 4 listas son siempre "estado actual".
export interface DashboardPeriod {
  from: string;
  to: string;
}

export interface DashboardKpis {
  salesTodayAmount: number;
  salesTodayCount: number;
  salesMonthAmount: number;
  receivablesAmount: number;
  payablesAmount: number;
  expensesMonthAmount: number;
  lowStockCount: number;
  purchasesPendingCount: number;
  salesPendingDispatchCount: number;
}

export interface DashboardLowStockItem {
  productId: string;
  code: string;
  name: string;
  currentStock: number;
  minimumStock: number;
  stockStatus: StockStatus;
}

export interface DashboardPendingDispatchItem {
  id: string;
  number: number;
  date: string;
  customerName: string;
  total: number;
}

export interface DashboardPendingReceiveItem {
  id: string;
  number: number;
  date: string;
  supplierName: string;
  total: number;
}

export interface DashboardRecentPayment {
  id: string;
  sourceType: string;
  sourceLabel: string;
  amount: number;
  status: string;
  createdAt: string;
}

// Máx. 5 ítems cada una, siempre las más recientes/relevantes — ya vienen
// resueltas (nombres de cliente/proveedor, labels), sin necesidad de otro llamado.
export interface DashboardResponse {
  period: DashboardPeriod;
  kpis: DashboardKpis;
  lowStock: DashboardLowStockItem[];
  pendingDispatch: DashboardPendingDispatchItem[];
  pendingReceive: DashboardPendingReceiveItem[];
  recentPayments: DashboardRecentPayment[];
}

export interface DashboardFilters {
  from?: string;
  to?: string;
}
