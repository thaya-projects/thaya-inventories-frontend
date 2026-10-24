import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type SalesTab = 'sales' | 'customers';

@Component({
  selector: 'app-sales-tabs',
  imports: [RouterLink],
  templateUrl: './sales-tabs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesTabs {
  active = input.required<SalesTab>();
}
