import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { CategoriesService } from '../../../core/services/categories';
import { Category } from '../../../core/models/category.model';

interface ParentOption {
  id: string;
  label: string;
}

function flatten(categories: Category[], depth = 0): { category: Category; depth: number }[] {
  return categories.flatMap(c => [{ category: c, depth }, ...flatten(c.children, depth + 1)]);
}

function collectIds(category: Category): Set<string> {
  const ids = new Set<string>([category.id]);
  for (const child of category.children) {
    for (const id of collectIds(child)) ids.add(id);
  }
  return ids;
}

@Component({
  selector: 'app-category-form-modal',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './category-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private categoriesService = inject(CategoriesService);

  // null/omitido = alta. Con id = edición de esa categoría.
  categoryId = input<string | null>(null);
  close = output<void>();
  saved = output<void>();

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);
  parentOptions = signal<ParentOption[]>([]);

  form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    parentId: [''],
  });

  ngOnInit(): void {
    const id = this.categoryId();

    // Necesitamos el árbol completo para armar el combo de "categoría padre"
    // (indentado por profundidad) y, en edición, para excluir la propia
    // categoría y sus descendientes (evita un ciclo obvio antes de pegarle al backend).
    this.categoriesService.list(true).subscribe({
      next: roots => {
        const excluded = id ? this.findAndCollectExcluded(roots, id) : new Set<string>();
        this.parentOptions.set(
          flatten(roots)
            .filter(({ category }) => !excluded.has(category.id))
            .map(({ category, depth }) => ({ id: category.id, label: `${'— '.repeat(depth)}${category.name}` })),
        );

        if (id) {
          this.categoriesService.get(id).subscribe({
            next: category => {
              this.form.patchValue({
                name: category.name,
                description: category.description ?? '',
                parentId: category.parentId ?? '',
              });
              this.loading.set(false);
            },
            error: () => {
              this.errorMessage.set('No se pudo cargar la categoría.');
              this.loading.set(false);
            },
          });
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de categorías.');
        this.loading.set(false);
      },
    });
  }

  private findAndCollectExcluded(roots: Category[], id: string): Set<string> {
    for (const { category } of flatten(roots)) {
      if (category.id === id) return collectIds(category);
    }
    return new Set<string>();
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const payload = {
      name: value.name!,
      description: value.description || undefined,
      parentId: value.parentId || null,
    };

    const id = this.categoryId();
    const request = id ? this.categoriesService.update(id, payload) : this.categoriesService.create(payload);

    request.subscribe({
      next: () => this.saved.emit(),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al guardar. Intenta nuevamente.';
  }
}
