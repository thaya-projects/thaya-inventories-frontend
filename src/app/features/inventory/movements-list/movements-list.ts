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
import { ORIGIN_STYLE, movementOrigin } from '../movement-origin';

const TYPE_LABELS: Record<MovementType, string> = {
  In: 'Entrada',
  Out: 'Salida',
  Adjustment: 'Conteo',
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
  origin = movementOrigin;
  originStyle = ORIGIN_STYLE;

  // Filtro por tipo: lo más buscado es "qué entró" y "qué salió".
  readonly typeFilters: { value: MovementType | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'In', label: 'Entradas' },
    { value: 'Out', label: 'Salidas' },
    { value: 'Adjustment', label: 'Conteos' },
  ];
  typeFilter = signal<MovementType | 'all'>('all');

  // Cada filtro vacío explica qué aparecería ahí.
  emptyMessage = computed(() => {
    switch (this.typeFilter()) {
      case 'In': return 'Todavía no entró nada. Las compras recibidas aparecen aquí solas.';
      case 'Out': return 'Todavía no salió nada. Las ventas entregadas aparecen aquí solas.';
      case 'Adjustment': return 'Todavía no hiciste conteos. Cuando cuentes lo que hay en el estante y no coincida, usa «Contar stock» y el sistema corrige la diferencia.';
      default: return 'No hay movimientos registrados todavía.';
    }
  });

  setTypeFilter(value: MovementType | 'all') {
    this.typeFilter.set(value);
    this.page.set(1);
    this.load();
  }

  // Entradas suman (+, verde), salidas restan (−, ámbar). El ajuste ya trae su signo.
  sign(m: InventoryMovement): '+' | '−' | '' {
    if (['In', 'Production', 'Return'].includes(m.movementType)) return '+';
    if (['Out', 'Waste', 'Scrap'].includes(m.movementType)) return '−';
    return m.quantity < 0 ? '−' : '+';
  }

  qty = (n: number) => (Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(2));

  private dateTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('dateTpl');
  private productTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('productTpl');
  private qtyTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('qtyTpl');
  private notesTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('notesTpl');
  private responsibleTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('responsibleTpl');
  private costTpl = viewChild.required<TemplateRef<{ $implicit: InventoryMovement }>>('costTpl');

  columns = computed<DataTableColumn<InventoryMovement>[]>(() => [
    { key: 'date', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'productName', label: 'Producto', cellTemplate: this.productTpl() },
    { key: 'quantity', label: 'Movimiento', cellTemplate: this.qtyTpl() },
    { key: 'notes', label: 'Motivo', cellTemplate: this.notesTpl() },
    // Almacén solo cuando la empresa maneja varios; si no, la columna queda siempre vacía.
    ...(this.blockedByMultiWarehouse() ? [{ key: 'warehouseName' as const, label: 'Almacén' }] : []),
    { key: 'unitCost', label: 'Costo c/u', cellTemplate: this.costTpl() },
    { key: 'responsibleName', label: 'Registró', cellTemplate: this.responsibleTpl() },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const type = this.typeFilter();
    this.movementsService.list(this.page(), this.pageSize(), type === 'all' ? undefined : { movementType: type }).subscribe({
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
    this.toast.success('Conteo guardado: el stock quedó corregido.');
    this.page.set(1);
    this.load();
  }
}
