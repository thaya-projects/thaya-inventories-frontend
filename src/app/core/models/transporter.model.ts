// Confirmado con /api/transporters. Sin CRUD en esta fase — solo combo
// (GET /api/transporters?isActive=true). Rol: Admin, Warehouse. Datos de
// vehículo (plate/brand/color), no de contacto como Suppliers/Customers —
// coherente con que se usa para calcular flete en ventas.
export interface Transporter {
  id: string;
  name: string;
  documentId: string | null;
  companyName: string | null;
  phone: string | null;
  plate: string | null;
  brand: string | null;
  color: string | null;
  usualDestination: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface TransporterListFilters {
  search?: string;
  isActive?: boolean;
}

export interface ListTransportersResponse {
  items: Transporter[];
}
