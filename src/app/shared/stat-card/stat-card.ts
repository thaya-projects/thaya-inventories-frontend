import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type StatCardTone = 'default' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCard {
  label = input.required<string>();
  value = input.required<string | number>();
  tone = input<StatCardTone>('default');

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
