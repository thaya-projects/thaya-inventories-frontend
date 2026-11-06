// Confirmado con /api/payment-methods (contra código real). Rol: ver → Admin,
// Warehouse, Assistant (para el combo de cobro). CRUD/set-default → solo Admin.
export type PaymentMethodType = 'Qr' | 'Transfer' | 'Cash' | 'Card' | 'Gateway';

// Al vender se muestra el tipo de pago, no el nombre interno de la cuenta:
// el cajero elige "QR", no "QR Banco Unión". Así se sabe cuánto entró por cada forma de pago.
export const PAYMENT_TYPE_LABELS: Record<PaymentMethodType, string> = {
  Cash: 'Efectivo',
  Qr: 'QR',
  Transfer: 'Transferencia',
  Card: 'Tarjeta',
  Gateway: 'Pago en línea',
};

// Nombre corto para elegir al cobrar. Si hay dos métodos del mismo tipo (ej. dos QR de bancos
// distintos), se usa el nombre configurado para poder distinguirlos.
export function paymentMethodLabel(method: PaymentMethod, all: PaymentMethod[]): string {
  const sameType = all.filter(m => m.type === method.type).length;
  return sameType > 1 ? method.name : PAYMENT_TYPE_LABELS[method.type] ?? method.name;
}

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
