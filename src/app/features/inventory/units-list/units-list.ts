import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { SearchInput } from '../../../shared/search-input/search-input';
import { UnitsOfMeasureService } from '../../../core/services/units-of-measure';
import { UnitOfMeasure } from '../../../core/models/unit-of-measure.model';
import { UnitFormModal } from '../unit-form-modal/unit-form-modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ToastService } from '../../../shared/toast/toast.service';
import { InventoryTabs } from '../inventory-tabs/inventory-tabs';

type StatusFilter = 'all' | 'active' | 'inactive';

const SEARCH_DEBOUNCE_MS = 400;

const TYPE_LABELS: Record<string, string> = {
  Weight: 'Peso',
  Volume: 'Volumen',
  Unit: 'Unidad',
  Length: 'Longitud',
  Time: 'Tiempo',
};

@Component({
  selector: 'app-units-list',
  imports: [DataTable, SearchInput, UnitFormModal, ConfirmDialog, InventoryTabs],
  templateUrl: './units-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnitsList {
  private unitsService = inject(UnitsOfMeasureService);
  private toast = inject(ToastService);

  units = signal<UnitOfMeasure[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  search = signal('');
  statusFilter = signal<StatusFilter>('all');
  updatingId = signal<string | null>(null);

  showFormModal = signal(false);
  editingUnitId = signal<string | null>(null);
  toggleTarget = signal<UnitOfMeasure | null>(null);

  typeLabel = (type: string) => TYPE_LABELS[type] ?? type;

  private searchTimeout?: ReturnType<typeof setTimeout>;

  private typeTpl = viewChild.required<TemplateRef<{ $implicit: UnitOfMeasure }>>('typeTpl');
  private activeTpl = viewChild.required<TemplateRef<{ $implicit: UnitOfMeasure }>>('activeTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: UnitOfMeasure }>>('actionsTpl');

  columns = computed<DataTableColumn<UnitOfMeasure>[]>(() => [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'abbreviation', label: 'Abrev.' },
    { key: 'type', label: 'Tipo', cellTemplate: this.typeTpl() },
    { key: 'baseFactor', label: 'Factor base' },
    { key: 'isActive', label: 'Estado', cellTemplate: this.activeTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const search = this.search().trim();
    const filter = this.statusFilter();
    const isActive = filter === 'all' ? undefined : filter === 'active';

    this.unitsService.list(this.page(), this.pageSize(), { search: search || undefined, isActive }).subscribe({
      next: result => {
        this.units.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de unidades.');
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    this.page.set(1);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  setFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
    this.page.set(1);
    this.load();
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

  openCreateModal() {
    this.editingUnitId.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(unit: UnitOfMeasure) {
    this.editingUnitId.set(unit.id);
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  onUnitSaved() {
    this.showFormModal.set(false);
    this.toast.success(this.editingUnitId() ? 'Unidad actualizada.' : 'Unidad creada.');
    this.load();
  }

  askToggleActive(unit: UnitOfMeasure) {
    this.toggleTarget.set(unit);
  }

  closeToggleConfirm() {
    if (this.updatingId()) return;
    this.toggleTarget.set(null);
  }

  confirmToggleActive() {
    const unit = this.toggleTarget();
    if (!unit) return;

    this.updatingId.set(unit.id);
    const action = unit.isActive ? this.unitsService.deactivate(unit.id) : this.unitsService.activate(unit.id);

    action.subscribe({
      next: () => {
        this.updatingId.set(null);
        this.toggleTarget.set(null);
        this.toast.success(unit.isActive ? 'Unidad desactivada.' : 'Unidad activada.');
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
