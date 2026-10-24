// Confirmado con /api/inventory-movements (contra código real — lista y
// detalle comparten el mismo InventoryMovementResponse). Roles: Admin, Warehouse.
export type MovementType =
  | 'In'
  | 'Out'
  | 'Adjustment'
  | 'Transfer'
  | 'Production'
  | 'Waste'
  | 'Return'
  | 'Scrap';

export interface InventoryMovement {
  id: string;
  date: string;
  warehouseId: string | null;
  warehouseName: string | null;
  productId: string;
  productCode: string;
  productName: string;
  variantId: string | null;
  // Siempre null por ahora — el backend no resuelve variantes todavía aunque el campo existe.
  variantName: string | null;
  unitOfMeasureId: string | null;
  unitOfMeasureName: string | null;
  movementType: MovementType;
  quantity: number;
  unitCost: number | null;
  // Calculado: quantity * unitCost. Null si unitCost es null.
  totalCost: number | null;
  lotOrSerial: string | null;
  // Sin resolver a nombre — solo el id.
  supplierId: string | null;
  responsibleId: string;
  responsibleName: string;
  notes: string | null;
  createdAt: string;
}

export interface MovementListFilters {
  productId?: string;
  warehouseId?: string;
  movementType?: MovementType;
  dateFrom?: string;
  dateTo?: string;
}

// POST /api/inventory-movements — solo 'In' | 'Out' en este sprint (el ajuste
// va por otro endpoint). Mismo casing PascalCase que devuelve la respuesta.
// TODO: el casing exacto que espera el POST no está probado contra el backend
// real (solo confirmamos el de la respuesta) — si el body falla, probar 'in'/'out'.
export interface CreateMovementRequest {
  date: string;
  warehouseId: string | null;
  productId: string;
  variantId: string | null;
  unitOfMeasureId: string | null;
  movementType: 'In' | 'Out';
  quantity: number;
  unitCost: number | null;
  lotOrSerial: string | null;
  supplierId: string | null;
  notes: string | null;
}

// POST /api/inventory-movements/adjustment — se manda el stock NUEVO, no el delta.
export interface AdjustMovementRequest {
  date: string;
  warehouseId: string | null;
  productId: string;
  variantId: string | null;
  unitOfMeasureId: string | null;
  newStock: number;
  notes: string | null;
}
