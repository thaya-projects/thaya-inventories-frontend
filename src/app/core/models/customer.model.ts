// Confirmado con /api/customers. Roles: ver/crear/editar → Admin, Warehouse,
// Assistant. Activar/desactivar → Admin, Warehouse (Assistant no).
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  taxId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface CustomerListFilters {
  search?: string;
  isActive?: boolean;
}

export interface ListCustomersResponse {
  items: Customer[];
}

// Mismo body en create y update.
export interface SaveCustomerRequest {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  taxId?: string | null;
}

// GET /api/customers/duplicates — mientras se llena el formulario.
// "TaxId" bloquea el alta (el backend responde 409); "Phone" y "Name" solo avisan.
export type CustomerDuplicateMatch = 'TaxId' | 'Phone' | 'Name';

export interface CustomerDuplicate {
  id: string;
  name: string;
  phone: string | null;
  taxId: string | null;
  city: string | null;
  isActive: boolean;
  matches: CustomerDuplicateMatch[];
}

export interface CustomerDuplicatesResponse {
  normalizedPhone: string | null;
  phoneValid: boolean;
  normalizedTaxId: string | null;
  duplicates: CustomerDuplicate[];
}
