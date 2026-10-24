// Confirmado con /api/suppliers. Roles: Admin, Warehouse.
export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  taxId: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface SupplierListFilters {
  search?: string;
  isActive?: boolean;
}

export interface ListSuppliersResponse {
  items: Supplier[];
}

// Mismo body en create y update.
export interface SaveSupplierRequest {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  taxId?: string | null;
  address?: string | null;
}
