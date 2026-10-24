import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { InventoryMovementsService } from '../../../core/services/inventory-movements';
import { InventoryMovement, MovementType } from '../../../core/models/inventory-movement.model';
import { CompanyContextService } from '../../../core/services/company-context';
import { MovementFormModal } from '../movement-form-modal/movement-form-modal';
import { MovementAdjustmentModal } from '../movement-adjustment-modal/movement-adjustment-modal';
import { ToastService } from '../../../shared/toast/toast.service';
import { InventoryTabs } from '../inventory-tabs/inventory-tabs';

const TYPE_LABELS: Record<MovementType, string> = {
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
  selector: 'app-movements-list',
  imports: [DataTable, DatePipe, MovementFormModal, MovementAdjustmentModal, InventoryTabs],
  templateUrl: './movements-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementsList {
  private movementsService = inject(InventoryMovementsService);
  private companyContext = inject(CompanyContextService);
  private toast = inject(ToastService);

  // Registrar entradas/salidas/ajustes está bloqueado por el backend para
  // empresas con multi-almacén (ver movement-form-modal). Se ocultan los
  // accesos acá para no mandar al usuario a un formulario que va a fallar seguro.
  blockedByMultiWarehouse = computed(() => this.companyContext.company()?.settings.usesMultiWarehouse === true);

  showMovementModal = signal(false);
  showAdjustmentModal = signal(false);

  movements = signal<InventoryMovement[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  typeLabel = (type: string) => TYPE_LABELS[type as MovementType] ?? type;

  private dateTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('dateTpl');
  private productTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('productTpl');
  private typeTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('typeTpl');
  private costTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('costTpl');

  columns = computed<DataTableColumn<InventoryMovement>[]>(() => [
    { key: 'date', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'productName', label: 'Producto', cellTemplate: this.productTpl() },
    { key: 'movementType', label: 'Tipo', cellTemplate: this.typeTpl() },
    { key: 'quantity', label: 'Cantidad' },
    { key: 'warehouseName', label: 'Almacén' },
    { key: 'unitCost', label: 'Costo', cellTemplate: this.costTpl() },
    { key: 'responsibleName', label: 'Responsable' },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.movementsService.list(this.page(), this.pageSize()).subscribe({
      next: result => {
        this.movements.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de movimientos.');
        this.loading.set(false);
      },
    });
  }

  onPageChange(page: number) {
    this.page.set(page);
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  openMovementModal() {
    this.showMovementModal.set(true);
  }

  closeMovementModal() {
    this.showMovementModal.set(false);
  }

  onMovementSaved(type: 'In' | 'Out') {
    this.showMovementModal.set(false);
    this.toast.success(type === 'In' ? 'Entrada registrada.' : 'Salida registrada.');
    this.page.set(1);
    this.load();
  }

  openAdjustmentModal() {
    this.showAdjustmentModal.set(true);
  }

  closeAdjustmentModal() {
    this.showAdjustmentModal.set(false);
  }

  onAdjustmentSaved() {
    this.showAdjustmentModal.set(false);
    this.toast.success('Ajuste de stock registrado.');
    this.page.set(1);
    this.load();
  }
}
