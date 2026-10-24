// /api/sales-orders/{id}/payments. TODO: sin JSON de ejemplo confirmado para
// GET (lista) ni para la respuesta del POST — solo se confirmó el body de
// alta. Se asume envelope {items:[...]} (mismo patrón que el resto de listas
// sin paginar) y que cada item trae paymentMethodName resuelto (misma
// convención "id"+"Name" del resto del backend).
export interface SalesOrderPayment {
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

export interface ListSalesOrderPaymentsResponse {
  items: SalesOrderPayment[];
}

// Confirmado (body de POST). qrImageUrl/proofImageUrl no tienen un endpoint
// de subida confirmado (a diferencia de imágenes de producto, que es
// multipart) — no se exponen en el form, se mandan null.
export interface CreateSalesOrderPaymentRequest {
  paymentMethodId: string;
  amount: number;
  currency: string;
  notes: string | null;
  qrImageUrl: string | null;
  proofImageUrl: string | null;
  // Default true. Si es false, el cobro queda Pending en Caja en vez de Paid.
  markAsPaid: boolean;
}
