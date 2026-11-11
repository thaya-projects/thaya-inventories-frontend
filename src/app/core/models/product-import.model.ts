// POST /api/products/import/preview (multipart "file") y POST /api/products/import.
export type ImportField =
  | 'name' | 'code' | 'salePrice' | 'cost' | 'stock' | 'minimumStock' | 'category' | 'unit' | 'description';

export interface ProductImportColumn {
  header: string;
  // null = la columna queda como característica (Marca, Modelo, Talla…).
  field: ImportField | null;
}

export interface ProductImportRow {
  rowNumber: number;
  name: string;
  code: string | null;
  codeGenerated: boolean;
  salePrice: number | null;
  cost: number | null;
  stock: number | null;
  minimumStock: number | null;
  categoryName: string | null;
  unitName: string | null;
  description: string | null;
  attributes: Record<string, string>;
  errors: string[];
  warnings: string[];
}

export interface ProductImportPreview {
  columns: ProductImportColumn[];
  rows: ProductImportRow[];
  validCount: number;
  errorCount: number;
  newCategories: string[];
}

export interface ImportProductItem {
  rowNumber: number;
  name: string;
  code: string | null;
  salePrice: number | null;
  cost: number | null;
  stock: number | null;
  minimumStock: number | null;
  categoryName: string | null;
  unitName: string | null;
  description: string | null;
  attributes: Record<string, string>;
}

export interface ImportProductsResult {
  created: number;
  withStock: number;
  categoriesCreated: string[];
  skipped: { rowNumber: number; name: string; reason: string }[];
}
