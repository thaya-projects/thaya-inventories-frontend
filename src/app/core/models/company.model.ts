import { ModulePresetValue } from '../../shared/module-preset';
import { CompanySettings } from './company-profile.model';

// Confirmado contra el OpenAPI real (PlatformCompanyResponse) — GET
// /api/platform/companies y GET /api/platform/companies/{id} comparten este
// shape, ambos incluyen `settings` (antes no lo teníamos tipado acá).
//
// isActive: el backend lo devuelve pero HOY NO HAY forma de cambiarlo — no
// existe ningún endpoint activate/deactivate/PUT para una empresa de
// plataforma (confirmado contra el spec real, no hay ni siquiera un intento
// con otro nombre). El botón de company-detail-modal se sacó por eso.
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
  settings: Partial<CompanySettings>;
}

export interface CompanyListFilters {
  search?: string;
  isActive?: boolean;
}

// Confirmado contra el OpenAPI real (CreatePlatformCompanyHttpRequest):
// companyName, adminFullName, adminEmail, adminPassword, planCode son
// requeridos; industry/taxId/modulePreset/usesLots son nullable del lado del
// back (opcionales), pero el front siempre los manda.
export interface CreateCompanyRequest {
  companyName: string;
  industry?: string;
  taxId?: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  planCode: string;
  trialDays: number;
  modulePreset: ModulePresetValue;
  usesLots: boolean;
}

// Confirmado contra el OpenAPI real (ChangeCompanyModulePresetHttpRequest) —
// PATCH /api/platform/companies/{id}/module-preset. Devuelve el Company
// completo actualizado (mismo shape que GET).
export interface ChangeCompanyModulePresetRequest {
  modulePreset: ModulePresetValue;
  usesLots: boolean;
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
