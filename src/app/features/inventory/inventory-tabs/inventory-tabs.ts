import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { CompanyContextService } from '../../../core/services/company-context';
import { AuthService } from '../../../core/services/auth';

export type InventoryTab = 'products' | 'movements' | 'categories' | 'units' | 'warehouses';

@Component({
  selector: 'app-inventory-tabs',
  imports: [RouterLink],
  templateUrl: './inventory-tabs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryTabs {
  private companyContext = inject(CompanyContextService);
  private auth = inject(AuthService);

  // Ventas solo consulta el catálogo: sin pestañas de movimientos, categorías, unidades ni almacenes.
  showTabs = computed(() => this.auth.currentUser()?.role !== 'Assistant');

  active = input.required<InventoryTab>();

  // Almacenes solo aparece con multi-almacén habilitado en plan y empresa.
  showWarehouses = computed(
    () =>
      this.companyContext.subscription()?.features?.multiWarehouse === true &&
      this.companyContext.company()?.settings.usesMultiWarehouse === true,
  );
}
