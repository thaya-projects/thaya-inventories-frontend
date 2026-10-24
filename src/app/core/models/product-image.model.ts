// Confirmado con /api/products/{productId}/images. Rol: Admin, Warehouse.
export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface ListProductImagesResponse {
  items: ProductImage[];
}

// PUT — sigue siendo JSON (a diferencia del POST, que es multipart). No
// cambia isPrimary (eso es solo vía PATCH set-primary).
export interface UpdateProductImageRequest {
  url: string;
  sortOrder: number;
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
