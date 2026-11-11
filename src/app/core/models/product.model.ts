// Confirmado con /api/products. Roles: List/Get → Admin, Warehouse, Assistant.
// Create/Update/Activate/Deactivate/Kardex → Admin, Warehouse (Assistant es solo lectura).
export type ProductType = 'RawMaterial' | 'Finished' | 'Service' | 'Kit' | 'Consumable';

// Calculado por el backend: OutOfStock (stock <= 0), Low (stock <= mínimo),
// Normal, o NotTracked si el producto no controla stock.
export type StockStatus = 'OutOfStock' | 'Low' | 'Normal' | 'NotTracked';

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productType: ProductType;
  categoryId: string | null;
  categoryName: string | null;
  unitOfMeasureId: string | null;
  unitOfMeasureName: string | null;
  tracksStock: boolean;
  hasVariants: boolean;
  currentStock: number;
  minimumStock: number;
  stockStatus: StockStatus;
  averageCost: number | null; // null para Ventas (no ve costos)
  salePrice: number | null;
  // Descuento opcional: sin fechas queda activo indefinidamente; con ambas,
  // se prende y apaga solo. isDiscountActive lo calcula el backend (ya
  // resuelto contra la fecha actual, no hay que comparar fechas a mano).
  discountPrice: number | null;
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  isDiscountActive: boolean;
  shelfLifeMonths: number | null;
  attributes: Record<string, unknown>;
  isActive: boolean;
  // Resuelto por el backend desde la imagen con isPrimary:true — null si no tiene ninguna.
  primaryImageUrl: string | null;
  // Solo un producto destacado por empresa — marcar uno desmarca al anterior (lo hace el backend).
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductListFilters {
  search?: string;
  categoryId?: string;
  productType?: ProductType;
  isActive?: boolean;
  tracksStock?: boolean;
  hasVariants?: boolean;
  // Solo productos que controlan stock y están en o bajo su mínimo.
  lowStock?: boolean;
}

// currentStock y averageCost no se mandan nunca — arrancan en 0 y solo se
// mueven vía /api/inventory-movements (Fase 3).
export interface CreateProductRequest {
  code: string;
  name: string;
  description?: string | null;
  productType: ProductType;
  categoryId?: string | null;
  unitOfMeasureId?: string | null;
  tracksStock: boolean;
  hasVariants: boolean;
  minimumStock: number;
  salePrice?: number | null;
  discountPrice?: number | null;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
  shelfLifeMonths?: number | null;
  attributes?: Record<string, unknown>;
}

// Mismo body que crear. hasVariants en el PUT solo sirve para desmarcarlo (las
// variantes no están soportadas). Sin attributes, el backend conserva las que había.
export interface UpdateProductRequest {
  code: string;
  name: string;
  description?: string | null;
  productType: ProductType;
  categoryId?: string | null;
  unitOfMeasureId?: string | null;
  tracksStock: boolean;
  hasVariants: boolean;
  minimumStock: number;
  salePrice?: number | null;
  discountPrice?: number | null;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
  shelfLifeMonths?: number | null;
  attributes?: Record<string, unknown>;
}

export type MovementType =
  | 'In'
  | 'Out'
  | 'Adjustment'
  | 'Transfer'
  | 'Production'
  | 'Waste'
  | 'Return'
  | 'Scrap';

export interface KardexMovement {
  date: string;
  movementType: MovementType;
  quantity: number;
  // Saldo acumulado DESPUÉS de este movimiento — no confundir con `quantity`.
  balance: number;
  unitCost: number;
  notes: string | null;
}

export interface ProductKardex {
  productId: string;
  productName: string;
  currentStock: number;
  movements: KardexMovement[];
}

export interface KardexFilters {
  dateFrom?: string;
  dateTo?: string;
}
