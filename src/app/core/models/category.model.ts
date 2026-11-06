// Confirmado con /api/categories. Rol: Admin, Warehouse. Jerarquía padre/hijo
// vía parentId (auto-referencia).
export interface Category {
  id: string;
  name: string;
  description: string | null;
  // Foto que la tienda online muestra para la categoría (null = sin foto).
  imageUrl?: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  // Solo se llena con GET ?tree=true. En lista plana y en detalle siempre
  // viene [] — no sirve para saber si tiene hijas fuera de modo árbol.
  children: Category[];
}

export interface CategoryListFilters {
  isActive?: boolean;
}

export interface ListCategoriesResponse {
  items: Category[];
}

export interface SaveCategoryRequest {
  name: string;
  description?: string;
  parentId?: string | null;
}
