// Confirmado con /api/warehouses. Rol: Admin, Warehouse en todo excepto
// set-default (solo Admin). Solo aparece en el menú si settings.usesMultiWarehouse.
// `address` ya no existe acá — el almacén ahora pertenece a una sucursal
// (branchId), que es la que tiene dirección (ver branch.model.ts).
export type WarehouseType = 'RawMaterial' | 'FinishedGoods' | 'General';

export interface Warehouse {
  id: string;
  code: string | null;
  name: string;
  branchId: string;
  warehouseType: WarehouseType;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface WarehouseListFilters {
  isActive?: boolean;
}

export interface ListWarehousesResponse {
  items: Warehouse[];
}

// isDefault siempre va en el body (no es opcional), aunque su valor sea
// false. Si es true, el backend desmarca automáticamente el default anterior.
export interface CreateWarehouseRequest {
  code?: string | null;
  name: string;
  branchId: string;
  warehouseType: WarehouseType;
  isDefault: boolean;
}

// PUT no incluye isDefault — eso se cambia solo con PATCH /{id}/set-default.
export interface UpdateWarehouseRequest {
  code?: string | null;
  name: string;
  branchId: string;
  warehouseType: WarehouseType;
}
