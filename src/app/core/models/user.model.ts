// Confirmado con /api/users (equipo de la empresa del token — nunca se pasa
// companyId por parámetro). Roles asignables desde acá: nunca "SuperAdmin"
// (el backend responde 400 "No se puede asignar el rol SuperAdmin." si se intenta).
export type TeamRole = 'Admin' | 'Warehouse' | 'Assistant';

// "Assistant" se muestra como Ventas: el valor técnico no cambia (va en el JWT y en los [Authorize]).
export const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: 'Super administrador',
  Admin: 'Administrador',
  Warehouse: 'Almacén',
  Assistant: 'Ventas',
};

// Qué puede hacer cada rol, en una línea (se ve al elegir el rol en Equipo).
export const ROLE_HINTS: Record<TeamRole, string> = {
  Admin: 'Todo: ventas, compras, inventario, caja, gastos, reportes, equipo y empresa.',
  Warehouse: 'Carga inventario: productos, stock, compras y producción. No ve ventas ni dinero.',
  Assistant: 'Vende, entrega y cobra. Ve productos y stock, sin costos ni ganancias.',
};

export interface TeamUser {
  id: string;
  fullName: string;
  email: string;
  userName: string;
  phone: string | null;
  // true solo si el usuario confirmó el código enviado por WhatsApp. Cambiar
  // el teléfono lo vuelve a false.
  phoneVerified: boolean;
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
