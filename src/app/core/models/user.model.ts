// Confirmado con /api/users (equipo de la empresa del token — nunca se pasa
// companyId por parámetro). Roles asignables desde acá: nunca "SuperAdmin"
// (el backend responde 400 "No se puede asignar el rol SuperAdmin." si se intenta).
export type TeamRole = 'Admin' | 'Warehouse' | 'Assistant';

export interface TeamUser {
  id: string;
  fullName: string;
  email: string;
  userName: string;
  phone: string | null;
  role: string; // 'SuperAdmin' | 'Admin' | 'Warehouse' | 'Assistant' — este endpoint nunca devuelve SuperAdmin
  isActive: boolean;
  lastLoginAt: string | null;
}

// GET /api/users — array plano envuelto en { users }, sin paginación.
export interface ListUsersResponse {
  users: TeamUser[];
}

// POST /api/users — sin confirmPassword (a diferencia de reset-password).
export interface CreateUserRequest {
  fullName: string;
  email: string;
  userName: string;
  phone: string | null;
  password: string;
  role: TeamRole;
}

// PUT /api/users/{id} — solo 3 campos, no es edición completa. email/userName
// no se pueden cambiar por API todavía.
export interface UpdateUserRequest {
  fullName: string;
  phone: string | null;
  role: TeamRole;
}
