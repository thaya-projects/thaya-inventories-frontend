// Confirmado con /api/payment-methods (contra código real). Rol: ver → Admin,
// Warehouse, Assistant (para el combo de cobro). CRUD/set-default → solo Admin.
export type PaymentMethodType = 'Qr' | 'Transfer' | 'Cash' | 'Card' | 'Gateway';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  isDefault: boolean;
  isActive: boolean;
  // Dictionary<string,object> no-nullable — siempre viene un objeto, {} si está vacío.
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
}

export interface PaymentMethodListFilters {
  isActive?: boolean;
}

export interface ListPaymentMethodsResponse {
  items: PaymentMethod[];
}

// isDefault solo en create. PUT no lo incluye (mismo patrón que Warehouses) —
// para cambiar el default es únicamente PATCH /{id}/set-default.
export interface CreatePaymentMethodRequest {
  name: string;
  type: PaymentMethodType;
  isDefault: boolean;
  details: Record<string, unknown>;
}

export interface UpdatePaymentMethodRequest {
  name: string;
  type: PaymentMethodType;
  details: Record<string, unknown>;
}
