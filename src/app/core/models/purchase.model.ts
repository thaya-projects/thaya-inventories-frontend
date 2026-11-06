// Confirmado con /api/purchases (contra código real — lista y detalle
// comparten el mismo PurchaseResponse, la lista también trae items[] completo,
// no un resumen). Roles: Admin, Warehouse.
export type PurchaseStatus = 'Pending' | 'Received' | 'Cancelled';

export interface PurchaseItemResponse {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  variantId: string | null;
  unitOfMeasureId: string | null;
  unitOfMeasureName: string | null;
  quantity: number;
  unitCost: number;
  total: number;
  // Texto libre, sin validación de formato/unicidad. Al recibir la compra,
  // el movimiento In generado copia este valor automáticamente.
  lotOrSerial: string | null;
}

export interface Purchase {
  id: string;
  number: number;
  date: string;
  warehouseId: string | null;
  warehouseName: string | null;
  supplierId: string;
  supplierName: string;
  // decimal? nullable en el backend — no asumir que siempre viene con valor.
  subtotal: number | null;
  discount: number;
  total: number | null;
  status: PurchaseStatus;
  responsibleId: string;
  responsibleName: string;
  notes: string | null;
  items: PurchaseItemResponse[];
  createdAt: string;
  updatedAt: string | null;
  // Solo en el listado: qué se compró, lo pagado y con qué tipos de pago ('Cash', 'Qr', ...).
  lines?: { productName: string; quantity: number }[] | null;
  paidAmount?: number | null;
  paymentMethodTypes?: string[] | null;
}

export interface PurchaseListFilters {
  status?: PurchaseStatus;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Body de un ítem en create/update. `id` solo se manda en el PUT: presente =
// actualiza esa línea, null = línea nueva. Las líneas existentes que no se
// incluyan, el backend las borra.
export interface PurchaseItemRequest {
  id?: string | null;
  productId: string;
  variantId: string | null;
  unitOfMeasureId: string | null;
  quantity: number;
  unitCost: number;
  // Opcional, máx. 40 caracteres — texto libre, aunque se genere con /api/lots/next.
  lotOrSerial?: string | null;
}

export interface SavePurchaseRequest {
  // Solo en alta. Compra directa: el backend la guarda y la recibe en el mismo paso (stock sube al instante).
  receiveNow?: boolean;
  date: string;
  warehouseId: string | null;
  supplierId: string;
  discount: number;
  notes: string | null;
  items: PurchaseItemRequest[];
}

// GET /api/purchases/last-cost?productId&supplierId — para avisar subas de precio al comprar.
export interface LastPurchaseCostItem {
  purchaseId: string;
  purchaseNumber: number;
  date: string;
  supplierId: string | null;
  supplierName: string | null;
  unitCost: number;
}

export interface LastPurchaseCost {
  productId: string;
  last: LastPurchaseCostItem | null;
  lastFromSupplier: LastPurchaseCostItem | null;
  averageCost: number;
  salePrice: number | null;
}
