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
  // Códigos de lote: "auto" autoasigna el siguiente código si se omite lotCode
  // al crear una orden de producción; cualquier otro valor se trata como manual.
  lotCodeMode: 'auto' | string;
  lotCodePrefixMp: string; // default "MP" si no se configura.
  lotCodePrefixPt: string; // default "PT" si no se configura.
  includeProductCode: boolean; // default false.
  // Landing pública de la empresa (PATCH /platform/companies/{id}/storefront).
  hasPublicStorefront: boolean;
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
// Confirmado: hace MERGE server-side (solo pisa las keys que mandás, el resto
// se conserva) — no hace falta mandar el objeto completo para no perder datos.
export interface UpdateCompanySettingsRequest {
  settings: Partial<CompanySettings>;
}
