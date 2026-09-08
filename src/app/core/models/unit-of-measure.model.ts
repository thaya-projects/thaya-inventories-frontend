// Confirmado con /api/units-of-measure. Rol: Admin, Warehouse.
export type UnitType = 'Weight' | 'Volume' | 'Unit' | 'Length' | 'Time';

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  abbreviation: string | null;
  type: UnitType;
  baseFactor: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface UnitOfMeasureListFilters {
  search?: string;
  isActive?: boolean;
}

// POST y PUT usan el mismo body — PUT reemplaza todo.
export interface SaveUnitOfMeasureRequest {
  code: string;
  name: string;
  abbreviation?: string;
  type: UnitType;
  baseFactor: number;
}
