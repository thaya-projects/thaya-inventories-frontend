import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { SearchInput } from '../../../shared/search-input/search-input';
import { CustomersService } from '../../../core/services/customers';
import { Customer } from '../../../core/models/customer.model';
import { AuthService } from '../../../core/services/auth';
import { CustomerFormModal } from '../customer-form-modal/customer-form-modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ToastService } from '../../../shared/toast/toast.service';
import { SalesTabs } from '../sales-tabs/sales-tabs';

type StatusFilter = 'all' | 'active' | 'inactive';

const SEARCH_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-customers-list',
  imports: [DataTable, SearchInput, CustomerFormModal, ConfirmDialog, SalesTabs],
  templateUrl: './customers-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersList {
  private customersService = inject(CustomersService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  // Clientes son de Admin y Ventas (Almacén no entra aquí): los dos pueden activar/desactivar.
  canToggleActive = computed(() => ['Admin', 'Assistant'].includes(this.auth.currentUser()?.role ?? ''));

  customers = signal<Customer[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  search = signal('');
  statusFilter = signal<StatusFilter>('all');
  updatingId = signal<string | null>(null);

  showFormModal = signal(false);
  editingCustomerId = signal<string | null>(null);
  toggleTarget = signal<Customer | null>(null);

  private searchTimeout?: ReturnType<typeof setTimeout>;

  private activeTpl = viewChild.required<TemplateRef<{ $implicit: Customer }>>('activeTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Customer }>>('actionsTpl');

  columns = computed<DataTableColumn<Customer>[]>(() => [
    { key: 'name', label: 'Nombre' },
    { key: 'taxId', label: 'NIT / CI' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'email', label: 'Correo' },
    { key: 'city', label: 'Ciudad' },
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

    this.customersService.list({ search: search || undefined, isActive }).subscribe({
      next: customers => {
        this.customers.set(customers);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de clientes.');
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
    this.editingCustomerId.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(customer: Customer) {
    this.editingCustomerId.set(customer.id);
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  onCustomerSaved() {
    this.showFormModal.set(false);
    this.toast.success(this.editingCustomerId() ? 'Cliente actualizado.' : 'Cliente creado.');
    this.load();
  }

  askToggleActive(customer: Customer) {
    this.toggleTarget.set(customer);
  }

  closeToggleConfirm() {
    if (this.updatingId()) return;
    this.toggleTarget.set(null);
  }

  confirmToggleActive() {
    const customer = this.toggleTarget();
    if (!customer) return;

    this.updatingId.set(customer.id);
    const action = customer.isActive
      ? this.customersService.deactivate(customer.id)
      : this.customersService.activate(customer.id);

    action.subscribe({
      next: () => {
        this.updatingId.set(null);
        this.toggleTarget.set(null);
        this.toast.success(customer.isActive ? 'Cliente desactivado.' : 'Cliente activado.');
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
