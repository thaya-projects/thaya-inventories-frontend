// Confirmado contra el OpenAPI real: GET /api/branches devuelve
// { items: BranchResponse[] } (no un array plano). Hoy cada empresa tiene
// una sola sucursal ("Sucursal Principal"), pero el endpoint ya es una lista.
export interface Branch {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ListBranchesResponse {
  items: Branch[];
}
