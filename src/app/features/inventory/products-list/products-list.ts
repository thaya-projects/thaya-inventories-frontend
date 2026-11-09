import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { CompanyContextService } from '../../../core/services/company-context';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { SearchInput } from '../../../shared/search-input/search-input';
import { ProductsService } from '../../../core/services/products';
import { Product } from '../../../core/models/product.model';
import { AuthService } from '../../../core/services/auth';
import { ToastService } from '../../../shared/toast/toast.service';
import { ProductFormModal } from '../product-form-modal/product-form-modal';
import { ProductImportModal } from '../product-import-modal/product-import-modal';
import { ImportProductsResult } from '../../../core/models/product-import.model';
import { InventoryTabs } from '../inventory-tabs/inventory-tabs';
import { StockBadge } from '../../../shared/stock-badge/stock-badge';
import { InfoHint } from '../../../shared/info-hint/info-hint';

type StatusFilter = 'all' | 'active' | 'inactive';

const SEARCH_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-products-list',
  imports: [DataTable, RouterLink, SearchInput, ProductFormModal, ProductImportModal, InventoryTabs, StockBadge, InfoHint],
  templateUrl: './products-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsList {
  private productsService = inject(ProductsService);
  private auth = inject(AuthService);
  private companyContext = inject(CompanyContextService);
  // El precio rebajado solo existe para la landing: sin landing se muestra el precio normal.
  hasStore = computed(() => this.companyContext.company()?.settings.hasPublicStorefront === true);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  // Assistant solo tiene List/Get — sin alta, edición, activar/desactivar ni kardex.
  canWrite = computed(() => this.auth.currentUser()?.role !== 'Assistant');

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
  // Solo productos en o bajo su stock mínimo (agotados incluidos). Se puede
  // llegar ya filtrado desde el Inicio con ?stock=low.
  lowStockOnly = signal(false);
  updatingId = signal<string | null>(null);

  private searchTimeout?: ReturnType<typeof setTimeout>;

  private nameTpl = viewChild.required<TemplateRef<{ $implicit: Product }>>('nameTpl');
  private stockTpl = viewChild.required<TemplateRef<{ $implicit: Product }>>('stockTpl');
  private priceTpl = viewChild.required<TemplateRef<{ $implicit: Product }>>('priceTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Product }>>('actionsTpl');

  columns = computed<DataTableColumn<Product>[]>(() => [
    { key: 'name', label: 'Producto', cellTemplate: this.nameTpl() },
    { key: 'currentStock', label: 'Stock', cellTemplate: this.stockTpl() },
    { key: 'salePrice', label: 'Precio de venta', cellTemplate: this.priceTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    // Permite llegar con un producto precargado para editar (ej. desde el Dashboard: ?edit=<id>).
    if (this.route.snapshot.queryParamMap.get('stock') === 'low') {
      this.lowStockOnly.set(true);
    }

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

    this.productsService.list(this.page(), this.pageSize(), { search: search || undefined, isActive, lowStock: this.lowStockOnly() || undefined }).subscribe({
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

  toggleLowStock() {
    this.lowStockOnly.set(!this.lowStockOnly());
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

  showImportModal = signal(false);

  // La lista se refresca al terminar; el modal queda abierto mostrando el resultado.
  onImported(result: ImportProductsResult) {
    if (result.created) this.load();
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
