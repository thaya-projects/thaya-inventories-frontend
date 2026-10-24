import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CategoriesService } from '../../../core/services/categories';
import { Category } from '../../../core/models/category.model';
import { CategoryTreeNode } from '../category-tree-node/category-tree-node';
import { CategoryFormModal } from '../category-form-modal/category-form-modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ToastService } from '../../../shared/toast/toast.service';
import { InventoryTabs } from '../inventory-tabs/inventory-tabs';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-categories-list',
  imports: [CategoryTreeNode, CategoryFormModal, ConfirmDialog, InventoryTabs],
  templateUrl: './categories-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesList {
  private categoriesService = inject(CategoriesService);
  private toast = inject(ToastService);

  roots = signal<Category[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  statusFilter = signal<StatusFilter>('all');
  updatingId = signal<string | null>(null);

  showFormModal = signal(false);
  editingCategoryId = signal<string | null>(null);
  toggleTarget = signal<Category | null>(null);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const filter = this.statusFilter();
    const isActive = filter === 'all' ? undefined : filter === 'active';

    this.categoriesService.list(true, { isActive }).subscribe({
      next: roots => {
        this.roots.set(roots);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de categorías.');
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
    this.load();
  }

  openCreateModal() {
    this.editingCategoryId.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(category: Category) {
    this.editingCategoryId.set(category.id);
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  onCategorySaved() {
    this.showFormModal.set(false);
    this.toast.success(this.editingCategoryId() ? 'Categoría actualizada.' : 'Categoría creada.');
    this.load();
  }

  askToggleActive(category: Category) {
    this.toggleTarget.set(category);
  }

  closeToggleConfirm() {
    if (this.updatingId()) return;
    this.toggleTarget.set(null);
  }

  confirmToggleActive() {
    const category = this.toggleTarget();
    if (!category) return;

    this.updatingId.set(category.id);
    const action = category.isActive
      ? this.categoriesService.deactivate(category.id)
      : this.categoriesService.activate(category.id);

    action.subscribe({
      next: () => {
        this.updatingId.set(null);
        this.toggleTarget.set(null);
        this.toast.success(category.isActive ? 'Categoría desactivada.' : 'Categoría activada.');
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
