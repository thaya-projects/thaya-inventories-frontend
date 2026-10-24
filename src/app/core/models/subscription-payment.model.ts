// Confirmado con /api/subscription-payments (listado/detalle/mark-paid) y
// POST /api/company-subscriptions/{id}/payments (creación — vive en esa ruta,
// no en /subscription-payments).
export interface SubscriptionPayment {
  id: string;
  companySubscriptionId: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  paymentProvider: string | null;
  providerPaymentId: string | null;
  status: string; // 'Pending' | 'Paid' | 'Failed' | 'Refunded'
  paidAt: string | null;
  invoiceUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SubscriptionPaymentListFilters {
  companySubscriptionId?: string;
  status?: string;
}

// El único campo es opcional — si se omite, el backend usa la hora actual (UTC).
export interface MarkPaidRequest {
  paidAt?: string;
}

// Body de POST /api/company-subscriptions/{id}/payments — {id} ahí es el
// companySubscriptionId, no el companyId.
export interface RegisterPaymentRequest {
  amount: number;
  currency?: string;
  paymentMethod?: string;
  paymentProvider?: string;
  providerPaymentId?: string;
  invoiceUrl?: string;
}
