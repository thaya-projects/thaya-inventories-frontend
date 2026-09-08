// /api/purchases/{id}/payments — mismo shape confirmado que
// company-subscriptions/sales-orders payments (mismo cuerpo, "mismo shape" tal
// como lo confirmaron). Reusa el mismo TODO de sales-order-payment.model.ts:
// GET (lista) y la respuesta del POST no vinieron con JSON de ejemplo para
// este endpoint puntual — se asume el mismo envelope {items:[...]}.
export interface PurchasePayment {
  id: string;
  paymentMethodId: string;
  paymentMethodName: string | null;
  amount: number;
  currency: string;
  notes: string | null;
  qrImageUrl: string | null;
  proofImageUrl: string | null;
  createdAt: string;
}

export interface ListPurchasePaymentsResponse {
  items: PurchasePayment[];
}

export interface CreatePurchasePaymentRequest {
  paymentMethodId: string;
  amount: number;
  currency: string;
  notes: string | null;
  qrImageUrl: string | null;
  proofImageUrl: string | null;
}
