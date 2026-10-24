// Envelope genérico que usa el backend para cualquier listado paginado
// (confirmado con /api/company: { items, page, pageSize, totalCount, totalPages }).
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
