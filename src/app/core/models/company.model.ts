// Confirmado con GET /api/platform/companies (respuesta real de backend).
export interface Company {
  id: string;
  name: string;
  industry: string;
  taxId: string;
  email: string;
  isActive: boolean;
  subscriptionStatus: string;
  planCode: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}

export interface CompanyListFilters {
  search?: string;
  isActive?: boolean;
}

// Confirmado con POST /api/platform/companies. Requeridos: companyName,
// adminFullName, adminEmail, adminPassword, planCode, trialDays.
// industry/taxId son opcionales.
export interface CreateCompanyRequest {
  companyName: string;
  industry?: string;
  taxId?: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  planCode: string;
  trialDays: number;
}

export interface CreateCompanyResponse {
  companyId: string;
  companyName: string;
  adminUserId: string;
  adminEmail: string;
  subscriptionId: string;
  trialEndsAt: string;
}

// Confirmado: POST /api/platform/companies/{companyId}/reset-admin-password.
// adminEmail debe ser el correo de un usuario con rol Admin de esa empresa
// (no hay un campo "adminEmail" separado en Company, por eso el modal lo deja
// editable en vez de asumir que company.email es ese correo).
export interface ResetAdminPasswordRequest {
  adminEmail: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetAdminPasswordResponse {
  companyId: string;
  adminUserId: string;
  adminEmail: string;
}
