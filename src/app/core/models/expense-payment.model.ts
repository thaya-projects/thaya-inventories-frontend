// POST /api/expenses/{id}/payments — mismo shape confirmado que
// sales-orders/purchases payments ("modal idéntico"). No hay GET
// /api/expenses/{id}/payments en el YAML — la lista de pagos de un gasto se
// pide con el endpoint genérico GET /api/payments?sourceId={expenseId}
// (ver PaymentsService.list).
export interface CreateExpensePaymentRequest {
  paymentMethodId: string;
  amount: number;
  currency: string;
  notes: string | null;
  qrImageUrl: string | null;
  proofImageUrl: string | null;
}
