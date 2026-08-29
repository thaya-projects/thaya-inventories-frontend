// Confirmado con GET /api/subscription-plans (respuesta real de backend).
export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number | null;
  priceQuarterly: number | null;
  priceYearly: number | null;
  maxUsers: number | null;
  maxProducts: number | null;
  maxStorageMb: number | null;
  features: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface SubscriptionPlanListResponse {
  items: SubscriptionPlan[];
}

// Mismo body para crear (POST) y actualizar (PUT, reemplaza todo el registro).
// Requeridos: code, name. El resto es opcional.
export interface SavePlanRequest {
  code: string;
  name: string;
  description?: string;
  priceMonthly?: number;
  priceQuarterly?: number;
  priceYearly?: number;
  maxUsers?: number;
  maxProducts?: number;
  maxStorageMb?: number;
  features?: Record<string, unknown>;
}
