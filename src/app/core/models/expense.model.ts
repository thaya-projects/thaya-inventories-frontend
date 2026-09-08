// Confirmado con /api/expenses (contra código real — lista y detalle
// comparten el mismo ExpenseResponse). Rol: solo Admin.
export type ExpenseCategory =
  | 'Transport'
  | 'Utilities'
  | 'Labor'
  | 'Maintenance'
  | 'RawMaterial'
  | 'Administrative'
  | 'Taxes'
  | 'Other';

// ⚠️ Único status del backend en minúscula — no es un enum C#, es un string
// calculado a mano (paidAmount<=0 ? "pending" : pendingAmount<=0 ? "paid" : "partial").
// NUNCA compartir mapeos de label/color con PaymentStatus (ese es PascalCase).
export type ExpensePaymentStatus = 'pending' | 'partial' | 'paid';

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  voucher: string | null;
  voucherImageUrl: string | null;
  // Siempre null en la práctica hoy — ningún flujo real los llena (no armar
  // ese vínculo, per Fase 5).
  sourceType: string | null;
  sourceId: string | null;
  // Resuelto server-side del token del creador — no va en el body.
  responsibleId: string;
  responsibleName: string | null;
  // Los 3 calculados por el backend, no vienen del body.
  paymentStatus: ExpensePaymentStatus;
  paidAmount: number;
  pendingAmount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface ExpenseListFilters {
  category?: ExpenseCategory;
  dateFrom?: string;
  dateTo?: string;
  // true = solo paymentStatus "paid". false = "pending"+"partial" mezclados
  // (no hay filtro para separar esos dos).
  paid?: boolean;
}

export interface SaveExpenseRequest {
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  voucher: string | null;
  voucherImageUrl: string | null;
  sourceType: null;
  sourceId: null;
}

// GET /{id}/payment-status — mismos 3 campos calculados que ya trae el
// ExpenseResponse completo; se deja definido por si se necesita un refresh
// liviano sin releer todo el gasto, pero hoy la UI simplemente vuelve a
// pedir el gasto completo (que ya incluye estos 3 campos actualizados).
export interface ExpensePaymentStatusResponse {
  amount: number;
  paymentStatus: ExpensePaymentStatus;
  paidAmount: number;
  pendingAmount: number;
}
