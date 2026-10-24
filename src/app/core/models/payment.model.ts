// Confirmado con /api/payments (contra código real — GET lista y GET
// detalle comparten el mismo PaymentResponse completo, sin diferencias).
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded' | 'Cancelled';

export interface Payment {
  id: string;
  paymentMethodId: string;
  paymentMethodName: string | null;
  paymentMethodType: string | null;
  // Confirmado y fijado por contrato back+front: PascalCase, comparación
  // exacta (case-sensitive) para SalesOrder/Purchase. Expense es la
  // excepción — sigue en snake_case ("expense") del lado del backend; ver
  // PaymentSourceType.Expense. labor_entry/subscription tampoco entraron a Caja todavía.
  sourceType: string;
  sourceId: string;
  sourceLabel: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentProvider: string | null;
  providerPaymentId: string | null;
  qrImageUrl: string | null;
  proofImageUrl: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// Único punto de verdad para sourceType en pagos — usar esto en filtros,
// labels y cualquier comparación con payment.sourceType. Nunca literales
// sueltos ('purchase', 'sales_order', etc.) en las pantallas.
export const PaymentSourceType = {
  SalesOrder: 'SalesOrder',
  Purchase: 'Purchase',
  // TODO: sin confirmar contra un pago real todavía — el backend deja este
  // sourceType en snake_case (no es un enum C#, no se pasó a PascalCase como
  // el resto). Si el back lo normaliza a "Expense" más adelante, es cambio de
  // una línea acá — ver comentario en app.routes / cash filter.
  Expense: 'expense',
} as const;

export type PaymentSourceTypeValue = (typeof PaymentSourceType)[keyof typeof PaymentSourceType];

export interface PaymentListFilters {
  sourceType?: PaymentSourceTypeValue;
  sourceId?: string;
  status?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
}

// PATCH /{id}/mark-paid — solo si status: Pending.
export interface MarkPaymentPaidRequest {
  paidAt: string;
  proofImageUrl: string | null;
  notes: string | null;
}
