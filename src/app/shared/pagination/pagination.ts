import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pagination {
  currentPage = input.required<number>();
  totalPages = input.required<number>();
  pageSize = input.required<number>();
  totalItems = input.required<number>();
  pageSizeOptions = input<number[]>([10, 20, 50, 100]);

  pageChange = output<number>();
  pageSizeChange = output<number>();

  rangeStart = computed(() =>
    this.totalItems() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1,
  );

  rangeEnd = computed(() => Math.min(this.rangeStart() + this.pageSize() - 1, this.totalItems()));

  // Ventana de páginas con "…" para no listar cientos de botones cuando hay muchas páginas.
  pageItems = computed<(number | '...')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const items: (number | '...')[] = [];

    for (let i = 1; i <= total; i++) {
      const isEdge = i === 1 || i === total;
      const isNearCurrent = Math.abs(i - current) <= 1;

      if (isEdge || isNearCurrent) {
        items.push(i);
      } else if (items[items.length - 1] !== '...') {
        items.push('...');
      }
    }

    return items;
  });

  onPageSizeChange(event: Event) {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
