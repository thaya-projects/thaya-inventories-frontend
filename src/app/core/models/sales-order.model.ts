// Confirmado con /api/sales-orders (contra código real — GET lista y detalle
// comparten el mismo SalesOrderResponse). Roles: ver/crear/editar Pending →
// Admin, Warehouse, Assistant. Despachar/cancelar → Admin, Warehouse (Assistant no).
export type SalesOrderStatus = 'Pending' | 'Dispatched' | 'Delivered' | 'Cancelled';

export type FreightType = 'None' | 'Included' | 'CustomerPays' | 'CompanyPays';

export interface SaleItemResponse {
  id: string; // id de la línea, no del producto.
  productId: string;
  productCode: string;
  productName: string;
  variantId: string | null; // siempre null hoy — variantes no implementadas en el flujo real.
  unitOfMeasureId: string | null;
  unitOfMeasureName: string | null;
  quantity: number;
  unitPrice: number | null;
  total: number | null; // quantity × unitPrice.
}

export interface SalesOrder {
  id: string;
  number: number;
  date: string;
  warehouseId: string | null;
  warehouseName: string | null;
  customerId: string;
  customerName: string | null;
  salespersonId: string;
  salespersonName: string | null;
  discount: number;
  freightType: FreightType;
  freightAmount: number;
  transporterId: string | null;
  transporterName: string | null;
  subtotal: number | null;
  total: number | null;
  // "Delivered" existe en el enum pero ningún endpoint lo dispara todavía
  // (solo dispatch → Dispatched, cancel → Cancelled) — no esperarlo en la práctica.
  status: SalesOrderStatus;
  notes: string | null;
  items: SaleItemResponse[];
  createdAt: string;
  updatedAt: string | null;
}

export interface SalesOrderListFilters {
  status?: SalesOrderStatus;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// `id` solo se manda en el PUT (igual que compras): presente = actualiza,
// null = línea nueva. Las que no se incluyan, el backend las borra.
export interface SaleItemRequest {
  id?: string | null;
  productId: string;
  variantId: string | null;
  unitOfMeasureId: string | null;
  quantity: number;
  unitPrice: number;
}

export interface SaveSalesOrderRequest {
  date: string;
  warehouseId: string | null;
  customerId: string;
  discount: number;
  freightType: FreightType;
  freightAmount: number;
  transporterId: string | null;
  notes: string | null;
  items: SaleItemRequest[];
}
