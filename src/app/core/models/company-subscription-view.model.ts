// Confirmado con GET /api/company/subscription (la suscripción de la empresa
// del usuario logueado — distinto de /api/company-subscriptions, que es la
// gestión del SuperAdmin y usa otro casing en status/billingCycle).
export interface CompanySubscriptionFeatures {
  inventory: boolean;
  purchases: boolean;
  sales: boolean;
  reports: boolean;
  production: boolean;
  aiAgents: boolean;
  multiWarehouse: boolean;
  loaders: boolean;
}

export interface CompanySubscriptionView {
  id: string;
  companyId: string;
  companyName: string;
  planId: string;
  planName: string;
  planCode: string;
  billingCycle: string; // 'monthly' | 'quarterly' | 'yearly'
  status: string; // 'trial' | 'active' | 'pastdue' | 'cancelled' | 'expired'
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  // Object libre (se define al crear planes) — claves faltantes = false.
  features: Partial<CompanySubscriptionFeatures>;
  createdAt: string;
  updatedAt: string | null;
}
