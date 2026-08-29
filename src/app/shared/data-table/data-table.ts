import { ChangeDetectionStrategy, Component, TemplateRef, computed, effect, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Pagination } from '../pagination/pagination';

export interface DataTableColumn<T> {
  key: keyof T & string;
  label: string;
  align?: 'left' | 'center' | 'right';
  cellTemplate?: TemplateRef<{ $implicit: T }>;
}

// Tabla genérica reusable: cada empresa/módulo define sus propias columnas y
// filas. Las celdas "especiales" (badges de estado, botones de acción, texto
// multilínea) se resuelven con un <ng-template> por columna — este componente
// no conoce nada del dominio de negocio.
//
// Dos modos de paginación:
// - Local (default): pasás todas las `rows` y el componente pagina solo.
// - Servidor (`serverSide=true`): el backend ya devuelve solo la página actual
//   en `rows`, junto con `totalItems`. El padre escucha (pageChange) y
//   (pageSizeChange) para volver a pedir la página que corresponda.
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, Pagination],
  templateUrl: './data-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTable<T = unknown> {
  columns = input.required<DataTableColumn<T>[]>();
  rows = input.required<T[]>();
  pageSize = input(10);
  pageSizeOptions = input<number[]>([10, 20, 50, 100]);
  emptyMessage = input('No hay datos para mostrar.');

  serverSide = input(false);
  currentPageInput = input<number>(1, { alias: 'currentPage' });
  totalItemsInput = input<number | undefined>(undefined, { alias: 'totalItems' });

  pageChange = output<number>();
  pageSizeChange = output<number>();

  private internalPage = signal(1);
  private pageSizeOverride = signal<number | null>(null);

  effectivePageSize = computed(() => this.pageSizeOverride() ?? this.pageSize());
  currentPage = computed(() => (this.serverSide() ? this.currentPageInput() : this.internalPage()));
  totalItems = computed(() => (this.serverSide() ? (this.totalItemsInput() ?? 0) : this.rows().length));

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.effectivePageSize())));

  pagedRows = computed(() => {
    // En modo servidor, `rows()` ya es solo la página actual.
    if (this.serverSide()) return this.rows();

    const size = this.effectivePageSize();
    const page = Math.min(this.internalPage(), this.totalPages());
    const start = (page - 1) * size;
    return this.rows().slice(start, start + size);
  });

  constructor() {
    // Modo local: si cambia el dataset completo (ej. un filtro externo),
    // volvemos a la página 1. En modo servidor el padre controla la página.
    effect(() => {
      this.rows();
      if (!this.serverSide()) {
        this.internalPage.set(1);
      }
    });
  }

  goToPage(page: number) {
    const clamped = Math.min(Math.max(1, page), this.totalPages());
    if (this.serverSide()) {
      this.pageChange.emit(clamped);
    } else {
      this.internalPage.set(clamped);
    }
  }

  onPageSizeChange(size: number) {
    if (this.serverSide()) {
      this.pageSizeChange.emit(size);
    } else {
      this.pageSizeOverride.set(size);
      this.internalPage.set(1);
    }
  }

  cellValue(row: T, col: DataTableColumn<T>) {
    return row[col.key];
  }
}
