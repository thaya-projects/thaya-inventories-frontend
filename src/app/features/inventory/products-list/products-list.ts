import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { SearchInput } from '../../../shared/search-input/search-input';
import { ProductsService } from '../../../core/services/products';
import { Product } from '../../../core/models/product.model';
import { AuthService } from '../../../core/services/auth';
import { CompanyContextService } from '../../../core/services/company-context';
import { ToastService } from '../../../shared/toast/toast.service';
import { ProductFormModal } from '../product-form-modal/product-form-modal';

type StatusFilter = 'all' | 'active' | 'inactive';

const SEARCH_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-products-list',
  imports: [DataTable, RouterLink, SearchInput, ProductFormModal],
  templateUrl: './products-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsList {
  private productsService = inject(ProductsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private companyContext = inject(CompanyContextService);

  // Assistant solo tiene List/Get — sin alta, edición, activar/desactivar ni kardex.
  canWrite = computed(() => this.auth.currentUser()?.role !== 'Assistant');

  // Menú "UX Admin": Almacenes ya no es un ítem hermano de Inventario en el
  // sidebar — vive acá adentro, gateado por multi-almacén (mismo AND entre
  // feature del plan y setting de la empresa que antes tenía el sidebar).
  showWarehousesLink = computed(
    () =>
      this.companyContext.subscription()?.features.multiWarehouse === true &&
      this.companyContext.company()?.settings.usesMultiWarehouse === true,
  );
  catalogMenuOpen = signal(false);

  showFormModal = signal(false);
  editingProductId = signal<string | null>(null);

  products = signal<Product[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  search = signal('');
  statusFilter = signal<StatusFilter>('all');
  updatingId = signal<string | null>(null);

  private searchTimeout?: ReturnType<typeof setTimeout>;

  private priceTpl = viewChild.required<TemplateRef<{ $implicit: Product }>>('priceTpl');
  private activeTpl = viewChild.required<TemplateRef<{ $implicit: Product }>>('activeTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Product }>>('actionsTpl');

  columns = computed<DataTableColumn<Product>[]>(() => [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'currentStock', label: 'Stock' },
    { key: 'salePrice', label: 'Precio', cellTemplate: this.priceTpl() },
    { key: 'isActive', label: 'Estado', cellTemplate: this.activeTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    // Permite llegar con un producto precargado para editar (ej. desde el Dashboard: ?edit=<id>).
    const editParam = this.route.snapshot.queryParamMap.get('edit');
    if (editParam) {
      this.openEditModal(editParam);
    }

    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const search = this.search().trim();
    const filter = this.statusFilter();
    const isActive = filter === 'all' ? undefined : filter === 'active';

    this.productsService.list(this.page(), this.pageSize(), { search: search || undefined, isActive }).subscribe({
      next: result => {
        this.products.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de productos.');
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

  toggleCatalogMenu() {
    this.catalogMenuOpen.update(v => !v);
  }

  closeCatalogMenu() {
    this.catalogMenuOpen.set(false);
  }

  openCreateModal() {
    this.editingProductId.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(productId: string) {
    this.editingProductId.set(productId);
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  onProductSaved(product: Product) {
    this.toast.success(`Producto "${product.name}" guardado.`);
    this.load();
  }

  toggleActive(product: Product) {
    this.updatingId.set(product.id);
    const action = product.isActive
      ? this.productsService.deactivate(product.id)
      : this.productsService.activate(product.id);

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

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error. Intenta nuevamente.';
  }
}
