// Confirmado con /api/company-subscriptions (backend real).
export interface CompanySubscription {
  id: string;
  companyId: string;
  companyName: string;
  planId: string;
  planName: string;
  planCode: string;
  billingCycle: string; // 'Monthly' | 'Quarterly' | 'Yearly'
  status: string; // 'Trial' | 'Active' | 'PastDue' | 'Cancelled' | 'Expired'
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  features: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
}

export interface CompanySubscriptionListFilters {
  companyId?: string;
  status?: string;
}

// POST /api/company-subscriptions — asignar plan a una empresa (bajo nivel;
// normalmente no hace falta porque POST /api/platform/companies ya crea la
// suscripción trial junto con la empresa).
export interface AssignSubscriptionRequest {
  companyId: string;
  planId: string;
  billingCycle: string;
  status: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}

// PUT /api/company-subscriptions/{id} — reemplaza todo, no cambia el status.
export interface UpdateSubscriptionRequest {
  planId: string;
  billingCycle: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
}

