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

// PUT /api/subscription-plans/{id} — reemplaza todo el registro. `code`
// sigue siendo obligatorio acá (edición explícita, sin autogeneración).
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

// POST /api/subscription-plans — `code` ahora es opcional (confirmado por
// backend). Si se omite (o va vacío/null), el backend lo genera a partir de
// `name` (slug) y resuelve duplicados solo con un sufijo numérico (-2, -3...)
// — el front no valida eso. Si se manda un code explícito y ya existe, sigue
// rechazando con 400 igual que antes.
export interface CreatePlanRequest extends Omit<SavePlanRequest, 'code'> {
  code: string | null;
}
