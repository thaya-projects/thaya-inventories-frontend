// Confirmado con /api/production-orders. Roles: Admin, Warehouse — Assistant
// no tiene acceso a ningún endpoint. Requiere settings.usesProduction=true en
// la empresa (400 "El módulo de producción no está habilitado..." si no).
export type ProductionOrderStatus = 'Planned' | 'InProgress' | 'Completed' | 'Cancelled';

export interface ProductionConsumption {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null; // siempre null hoy — variantes no soportadas.
  unitOfMeasureId: string;
  unitOfMeasureName: string;
  quantity: number;
  wasteQuantity: number;
  unitCost: number | null;
  // totalCost = quantity × unitCost — queda en 0 hasta /complete.
  totalCost: number;
  // Solo relevante mientras la orden no está Completed — el back marca el
  // consumo si la cantidad a usar supera el stock actual de esa MP. No
  // bloquea crear/guardar; sí bloquea completar (el back rechaza con 400 si
  // de verdad no alcanza).
  insufficientStock?: boolean;
  // null/ausente hasta completar (FIFO todavía no repartió lotes de MP). Se
  // llena al completar — string ya formateado por el back, ej. "MP-0001, MP-0002".
  lotOrSerial?: string | null;
}

export interface ProductionOrder {
  id: string;
  lotCode: string;
  date: string;
  // Reemplaza al anterior warehouseId/warehouseName único — ahora son dos
  // pares independientes: de dónde sale la MP y a dónde entra el PT.
  sourceWarehouseId: string | null;
  sourceWarehouseName: string | null;
  destinationWarehouseId: string | null;
  destinationWarehouseName: string | null;
  productId: string;
  productCode: string;
  productName: string;
  unitOfMeasureId: string;
  unitOfMeasureName: string;
  quantityProduced: number;
  remainingStock: number;
  expirationDate: string | null;
  sanitaryRegistration: string | null;
  // rawMaterialCost = suma de quantity × unitCost de cada consumo — queda en 0 hasta /complete.
  rawMaterialCost: number;
  referencePrice: number | null;
  wasteQuantity: number;
  wasteNotes: string | null;
  responsibleId: string;
  responsibleName: string;
  status: ProductionOrderStatus;
  consumptions: ProductionConsumption[];
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductionOrderListFilters {
  status?: ProductionOrderStatus;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// `id` solo se manda en el PUT (igual que compras/ventas): presente = actualiza,
// null/omitido = línea nueva. Las que no se incluyan, el backend las borra.
export interface ProductionConsumptionRequest {
  id?: string | null;
  productId: string;
  variantId: string | null;
  unitOfMeasureId: string;
  quantity: number;
  wasteQuantity: number;
  unitCost: number | null;
}

export interface SaveProductionOrderRequest {
  // Opcional: si se omite (o null/'') y la empresa tiene lotCodeMode='auto',
  // el backend autoasigna el siguiente código — mismo mecanismo de /api/lots/next.
  // Si el modo no es 'auto' y se omite, el backend devuelve el error de siempre
  // ("El código de lote es requerido"). Máx. 40 caracteres.
  lotCode: string | null;
  date: string;
  sourceWarehouseId: string | null;
  destinationWarehouseId: string | null;
  productId: string;
  unitOfMeasureId: string;
  quantityProduced: number;
  expirationDate: string | null;
  sanitaryRegistration: string | null;
  referencePrice: number | null;
  wasteQuantity: number;
  wasteNotes: string | null;
  consumptions: ProductionConsumptionRequest[];
}

// Body opcional — si no se manda nada, /complete usa los valores que ya tenía la orden.
export interface CompleteProductionOrderRequest {
  quantityProduced?: number;
  wasteQuantity?: number;
  wasteNotes?: string | null;
  remainingStock?: number;
}
