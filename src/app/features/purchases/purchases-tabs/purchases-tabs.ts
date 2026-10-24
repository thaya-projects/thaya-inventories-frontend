import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type PurchasesTab = 'purchases' | 'suppliers';

@Component({
  selector: 'app-purchases-tabs',
  imports: [RouterLink],
  templateUrl: './purchases-tabs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchasesTabs {
  active = input.required<PurchasesTab>();
}
