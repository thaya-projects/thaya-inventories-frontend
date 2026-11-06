import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StockStatus } from '../../core/models/product.model';

const STYLES: Record<StockStatus, { label: string; pill: string; dot: string }> = {
  OutOfStock: { label: 'Agotado', pill: 'bg-gr-danger-bg text-gr-danger', dot: 'bg-gr-danger' },
  Low: { label: 'Stock bajo', pill: 'bg-gr-warning-bg text-gr-warning', dot: 'bg-gr-warning' },
  Normal: { label: 'Disponible', pill: 'bg-gr-success-bg text-gr-success', dot: 'bg-gr-success' },
  NotTracked: { label: 'Sin control', pill: 'bg-gr-bg text-gr-muted', dot: 'bg-gr-muted' },
};

// Muestra el stock con color según su estado: rojo agotado, ámbar bajo el
// mínimo, verde disponible, gris si el producto no controla stock.
// El estado lo calcula el backend (stockStatus); si no viene, se deriva acá.
export function resolveStockStatus(tracksStock: boolean, current: number, minimum: number): StockStatus {
  if (!tracksStock) return 'NotTracked';
  if (current <= 0) return 'OutOfStock';
  if (current <= minimum) return 'Low';
  return 'Normal';
}

@Component({
  selector: 'app-stock-badge',
  template: `
    <span class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap" [class]="style().pill" [title]="tooltip()">
      <span class="h-2 w-2 shrink-0 rounded-full" [class]="style().dot"></span>
      @if (status() === 'NotTracked') {
        {{ style().label }}
      } @else {
        <span class="tabular-nums">{{ current() }}{{ unitLabel() ? ' ' + unitLabel() : '' }}</span>
        @if (showLabel()) {
          <span class="opacity-80">· {{ style().label }}</span>
        }
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockBadge {
  current = input.required<number>();
  minimum = input<number>(0);
  tracksStock = input<boolean>(true);
  status = input<StockStatus | null | undefined>(null);
  unit = input<string | null>(null);
  showLabel = input<boolean>(true);

  private effectiveStatus = computed<StockStatus>(
    () => this.status() ?? resolveStockStatus(this.tracksStock(), this.current(), this.minimum()),
  );

  style = computed(() => STYLES[this.effectiveStatus()]);

  // "Unidad" → "11 unidades" / "1 unidad"; "Docena" → "docenas". Abreviaturas (kg, m) quedan igual.
  unitLabel = computed(() => {
    const u = (this.unit() ?? '').trim();
    if (!u) return '';
    if (u.length <= 3 || /[^a-záéíóúñü ]/i.test(u)) return u;
    const lower = u.toLowerCase();
    if (Math.abs(this.current()) === 1) return lower;
    if (/[aeiouáéó]$/.test(lower)) return lower + 's';
    if (lower.endsWith('z')) return lower.slice(0, -1) + 'ces';
    return lower + 'es';
  });

  tooltip = computed(() =>
    this.effectiveStatus() === 'NotTracked'
      ? 'Este producto no controla stock.'
      : `${this.style().label}: ${this.current()} en stock, mínimo ${this.minimum()}.`,
  );
}
