// Confirmado con /api/notifications. Auth: cualquier usuario autenticado, sin
// restricción de rol en el backend (hoy las alertas de stock llegan a TODA la
// empresa, sin filtrar por rol — no asumir que Assistant nunca las ve).
export const NotificationType = {
  Info: 'Info',
  Success: 'Success',
  Warning: 'Warning',
  Error: 'Error',
  Payment: 'Payment',
  AgentAction: 'AgentAction',
  StockAlert: 'StockAlert',
} as const;

export type NotificationTypeValue = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationChannel = {
  InApp: 'InApp',
  Email: 'Email',
  WhatsApp: 'WhatsApp',
  Push: 'Push',
} as const;

export type NotificationChannelValue = (typeof NotificationChannel)[keyof typeof NotificationChannel];

// PascalCase por contrato — pero el único generador real hoy (alertas de
// stock) manda sourceType en minúscula ("product"), va a cambiar pronto. Por
// eso sourceType queda tipado como string crudo acá abajo, y TODA comparación
// pasa por normalizeSourceType() (un solo lugar, no repetir el mapeo en cada
// pantalla).
export const NotificationSourceType = {
  Product: 'Product',
  SalesOrder: 'SalesOrder',
  Purchase: 'Purchase',
  Payment: 'Payment',
  Expense: 'Expense',
} as const;

export type NotificationSourceTypeValue = (typeof NotificationSourceType)[keyof typeof NotificationSourceType];

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationTypeValue;
  channel: NotificationChannelValue;
  isRead: boolean;
  readAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  // Object libre, shape no fijo todavía (puede cambiar por tipo) — no asumir
  // claves más allá de las que se usan puntualmente (ej. data.link).
  data: Record<string, unknown>;
  createdAt: string;
}

export interface ListNotificationsResponse {
  items: Notification[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationListFilters {
  isRead?: boolean;
  type?: NotificationTypeValue;
}

// Único punto de normalización de sourceType — nunca comparar
// notification.sourceType crudo en más de un archivo.
export function normalizeSourceType(sourceType: string | null): NotificationSourceTypeValue | null {
  if (!sourceType) return null;

  const key = sourceType.toLowerCase().replace(/_/g, '');
  switch (key) {
    case 'product':
      return NotificationSourceType.Product;
    case 'salesorder':
      return NotificationSourceType.SalesOrder;
    case 'purchase':
      return NotificationSourceType.Purchase;
    case 'payment':
      return NotificationSourceType.Payment;
    case 'expense':
      return NotificationSourceType.Expense;
    default:
      return null;
  }
}

// A dónde navegar al hacer click en una notificación.
// Prioriza sourceType+sourceId (mapea a rutas reales confirmadas del front)
// sobre data.link: el ejemplo real que dieron trae "/products/uuid", pero
// nuestra ruta real es "/inventory/products/:id" — usar data.link tal cual
// mandaría a un 404. Se deja como último fallback por si data.link resuelve
// algo que sourceType/sourceId no puedan (tipo desconocido/futuro).
export function routeForNotification(n: Notification): string | null {
  const sourceType = normalizeSourceType(n.sourceType);
  const id = n.sourceId;

  if (sourceType && id) {
    switch (sourceType) {
      // Product no tiene página de detalle — se edita por modal desde
      // products-list (mismo patrón que el link de "Stock bajo" del dashboard).
      case NotificationSourceType.Product:
        return `/inventory/products?edit=${encodeURIComponent(id)}`;
      // SalesOrder/Purchase: el detalle ya no es página — "Ver" abre un modal
      // desde el listado vía ?view=<id> (ver app.routes.ts).
      case NotificationSourceType.SalesOrder:
        return `/sales?view=${encodeURIComponent(id)}`;
      case NotificationSourceType.Purchase:
        return `/purchases?view=${encodeURIComponent(id)}`;
      case NotificationSourceType.Payment:
        return '/cash/payments';
      case NotificationSourceType.Expense:
        return `/expenses/${id}`;
    }
  }

  const link = n.data?.['link'];
  if (typeof link === 'string' && link.startsWith('/')) {
    return link;
  }

  return null;
}
