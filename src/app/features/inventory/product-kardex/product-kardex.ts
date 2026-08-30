import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ProductsService } from '../../../core/services/products';
import { ProductKardex } from '../../../core/models/product.model';

const MOVEMENT_LABELS: Record<string, string> = {
  In: 'Entrada',
  Out: 'Salida',
  Adjustment: 'Ajuste',
  Transfer: 'Transferencia',
  Production: 'Producción',
  Waste: 'Merma',
  Return: 'Devolución',
  Scrap: 'Descarte',
};

@Component({
  selector: 'app-product-kardex',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './product-kardex.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductKardexPage {
  private productsService = inject(ProductsService);
  private route = inject(ActivatedRoute);

  productId = this.route.snapshot.paramMap.get('id')!;

  kardex = signal<ProductKardex | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  dateFrom = signal('');
  dateTo = signal('');

  movementLabel = (type: string) => MOVEMENT_LABELS[type] ?? type;

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.productsService
      .kardex(this.productId, { dateFrom: this.dateFrom() || undefined, dateTo: this.dateTo() || undefined })
      .subscribe({
        next: kardex => {
          this.kardex.set(kardex);
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo cargar el kardex del producto.');
          this.loading.set(false);
        },
      });
  }

  applyFilters() {
    this.load();
  }

  clearFilters() {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.load();
  }
}
