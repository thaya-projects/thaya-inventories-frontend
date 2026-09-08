import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { SearchInput } from '../../../shared/search-input/search-input';
import { SuppliersService } from '../../../core/services/suppliers';
import { Supplier } from '../../../core/models/supplier.model';
import { SupplierFormModal } from '../supplier-form-modal/supplier-form-modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ToastService } from '../../../shared/toast/toast.service';

type StatusFilter = 'all' | 'active' | 'inactive';

const SEARCH_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-suppliers-list',
  imports: [DataTable, SearchInput, SupplierFormModal, ConfirmDialog],
  templateUrl: './suppliers-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuppliersList {
  private suppliersService = inject(SuppliersService);
  private toast = inject(ToastService);

  suppliers = signal<Supplier[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  search = signal('');
  statusFilter = signal<StatusFilter>('all');
  updatingId = signal<string | null>(null);

  showFormModal = signal(false);
  editingSupplierId = signal<string | null>(null);
  toggleTarget = signal<Supplier | null>(null);

  private searchTimeout?: ReturnType<typeof setTimeout>;

  private activeTpl = viewChild.required<TemplateRef<{ $implicit: Supplier }>>('activeTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Supplier }>>('actionsTpl');

  columns = computed<DataTableColumn<Supplier>[]>(() => [
    { key: 'name', label: 'Nombre' },
    { key: 'contactName', label: 'Contacto' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'email', label: 'Correo' },
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

    this.suppliersService.list({ search: search || undefined, isActive }).subscribe({
      next: suppliers => {
        this.suppliers.set(suppliers);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de proveedores.');
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  setFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
    this.load();
  }

  openCreateModal() {
    this.editingSupplierId.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(supplier: Supplier) {
    this.editingSupplierId.set(supplier.id);
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  onSupplierSaved() {
    this.showFormModal.set(false);
    this.toast.success(this.editingSupplierId() ? 'Proveedor actualizado.' : 'Proveedor creado.');
    this.load();
  }

  askToggleActive(supplier: Supplier) {
    this.toggleTarget.set(supplier);
  }

  closeToggleConfirm() {
    if (this.updatingId()) return;
    this.toggleTarget.set(null);
  }

  confirmToggleActive() {
    const supplier = this.toggleTarget();
    if (!supplier) return;

    this.updatingId.set(supplier.id);
    const action = supplier.isActive
      ? this.suppliersService.deactivate(supplier.id)
      : this.suppliersService.activate(supplier.id);

    action.subscribe({
      next: () => {
        this.updatingId.set(null);
        this.toggleTarget.set(null);
        this.toast.success(supplier.isActive ? 'Proveedor desactivado.' : 'Proveedor activado.');
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
