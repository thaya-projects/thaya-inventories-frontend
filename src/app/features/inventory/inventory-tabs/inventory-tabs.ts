import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { CompanyContextService } from '../../../core/services/company-context';

export type InventoryTab = 'products' | 'movements' | 'categories' | 'units' | 'warehouses';

@Component({
  selector: 'app-inventory-tabs',
  imports: [RouterLink],
  templateUrl: './inventory-tabs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryTabs {
  private companyContext = inject(CompanyContextService);

  active = input.required<InventoryTab>();

  // Almacenes solo aparece con multi-almacén habilitado en plan y empresa.
  showWarehouses = computed(
    () =>
      this.companyContext.subscription()?.features.multiWarehouse === true &&
      this.companyContext.company()?.settings.usesMultiWarehouse === true,
  );
}
