import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InfoHint } from '../info-hint/info-hint';

export type StatCardTone = 'default' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-stat-card',
  imports: [InfoHint],
  templateUrl: './stat-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCard {
  label = input.required<string>();
  value = input.required<string | number>();
  tone = input<StatCardTone>('default');
  // Explicación de qué mide el indicador (ícono "i").
  hint = input<string | null>(null);
  // Texto chico bajo el valor (ej. "3 ventas").
  caption = input<string | null>(null);


  valueClass = computed(() => {
    switch (this.tone()) {
      case 'success':
        return 'text-gr-success';
      case 'warning':
        return 'text-gr-warning';
      case 'danger':
        return 'text-gr-danger';
      default:
        return 'text-gr-text';
    }
  });
}
