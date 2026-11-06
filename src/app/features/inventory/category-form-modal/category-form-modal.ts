import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Observable, of, switchMap } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { CategoriesService } from '../../../core/services/categories';
import { Category } from '../../../core/models/category.model';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
  private destroyRef = inject(DestroyRef);

  // null/omitido = alta. Con id = edición de esa categoría.
  categoryId = input<string | null>(null);
  close = output<void>();
  saved = output<void>();

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);
  parentOptions = signal<ParentOption[]>([]);

  // Foto: se elige aquí y se sube al guardar (en una categoría nueva todavía no hay id).
  savedImageUrl = signal<string | null>(null);
  pendingFile = signal<File | null>(null);
  private pendingPreview = signal<string | null>(null);
  removeImage = signal(false);
  // Si se creó la categoría pero falló la foto, el reintento actualiza en vez de crear otra.
  private createdId = signal<string | null>(null);
  imageError = signal<string | null>(null);
  dragging = signal(false);
  previewUrl = computed(() => this.pendingPreview() ?? (this.removeImage() ? null : this.savedImageUrl()));

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

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
              this.savedImageUrl.set(category.imageUrl ?? null);
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

  onFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.pickFile(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.pickFile(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  private pickFile(file: File) {
    if (!IMAGE_TYPES.includes(file.type)) {
      this.imageError.set('Usa una foto JPG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.imageError.set('La foto pesa más de 5 MB. Prueba con una más liviana.');
      return;
    }
    this.imageError.set(null);
    this.revokePreview();
    this.pendingFile.set(file);
    this.pendingPreview.set(URL.createObjectURL(file));
    this.removeImage.set(false);
  }

  clearImage() {
    this.revokePreview();
    this.pendingFile.set(null);
    this.pendingPreview.set(null);
    this.imageError.set(null);
    this.removeImage.set(!!this.savedImageUrl());
  }

  private revokePreview() {
    const url = this.pendingPreview();
    if (url) URL.revokeObjectURL(url);
  }

  // Después de guardar los datos: sube la foto nueva o quita la anterior.
  private syncImage(category: Category): Observable<unknown> {
    const file = this.pendingFile();
    if (file) return this.categoriesService.uploadImage(category.id, file);
    if (this.removeImage()) return this.categoriesService.removeImage(category.id);
    return of(null);
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

    const id = this.categoryId() ?? this.createdId();
    const request = id ? this.categoriesService.update(id, payload) : this.categoriesService.create(payload);
    let dataSaved = false;

    request
      .pipe(
        switchMap(category => {
          dataSaved = true;
          if (!id) this.createdId.set(category.id);
          return this.syncImage(category);
        }),
      )
      .subscribe({
        next: () => this.saved.emit(),
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(
            dataSaved
              ? `La categoría se guardó, pero la foto no se pudo subir: ${this.mapError(err)}`
              : this.mapError(err),
          );
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
