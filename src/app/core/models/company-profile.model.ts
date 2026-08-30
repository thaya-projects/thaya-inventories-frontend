// Confirmado con GET /api/company (empresa del usuario logueado, distinto de
// GET /platform/companies que usa el SuperAdmin — ver company.model.ts).
export interface CompanySettings {
  usesProduction: boolean;
  usesLots: boolean;
  usesVariants: boolean;
  usesWeight: boolean;
  usesLoaders: boolean;
  usesMultiWarehouse: boolean;
  activeModules: string[];
}

export interface CompanyProfile {
  id: string;
  name: string;
  isActive: boolean;
  industry: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  logoUrl: string | null;
  // Object libre en el backend (OpenAPI: object sin schema) — puede venir
  // incompleto o vacío; tratar claves faltantes como false / [].
  settings: Partial<CompanySettings>;
  createdAt: string;
  updatedAt: string | null;
}

// PUT /api/company
export interface UpdateCompanyRequest {
  name: string;
  industry: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  logoUrl: string | null;
}

// PUT /api/company/settings — el body va envuelto en { settings: {...} }, no plano.
export interface UpdateCompanySettingsRequest {
  settings: Partial<CompanySettings>;
}
