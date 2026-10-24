import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { WarehousesService } from '../../../core/services/warehouses';
import { Warehouse } from '../../../core/models/warehouse.model';
import { AuthService } from '../../../core/services/auth';
import { ToastService } from '../../../shared/toast/toast.service';
import { InventoryTabs } from '../inventory-tabs/inventory-tabs';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-warehouses-list',
  imports: [DataTable, RouterLink, InventoryTabs],
  templateUrl: './warehouses-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarehousesList {
  private warehousesService = inject(WarehousesService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  // set-default es exclusivo de Admin (403 para Warehouse) — se oculta el botón.
  isAdmin = computed(() => this.auth.currentUser()?.role === 'Admin');

  warehouses = signal<Warehouse[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  statusFilter = signal<StatusFilter>('all');
  updatingId = signal<string | null>(null);

  private defaultTpl = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('defaultTpl');
  private activeTpl = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('activeTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('actionsTpl');

  columns = computed<DataTableColumn<Warehouse>[]>(() => [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'address', label: 'Dirección' },
    { key: 'isDefault', label: 'Predeterminado', cellTemplate: this.defaultTpl() },
    { key: 'isActive', label: 'Estado', cellTemplate: this.activeTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const filter = this.statusFilter();
    const isActive = filter === 'all' ? undefined : filter === 'active';

    this.warehousesService.list({ isActive }).subscribe({
      next: warehouses => {
        this.warehouses.set(warehouses);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de almacenes.');
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
    this.load();
  }

  toggleActive(warehouse: Warehouse) {
    this.updatingId.set(warehouse.id);
    const action = warehouse.isActive
      ? this.warehousesService.deactivate(warehouse.id)
      : this.warehousesService.activate(warehouse.id);

    action.subscribe({
      next: () => {
        this.updatingId.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.updatingId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
  }

  setDefault(warehouse: Warehouse) {
    this.updatingId.set(warehouse.id);
    this.warehousesService.setDefault(warehouse.id).subscribe({
      next: () => {
        this.updatingId.set(null);
        this.toast.success(`"${warehouse.name}" es ahora el almacén predeterminado.`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.updatingId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error. Intenta nuevamente.';
  }
}
