import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { WarehousesService } from '../../../core/services/warehouses';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'app-warehouse-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './warehouse-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarehouseForm {
  private fb = inject(FormBuilder);
  private warehousesService = inject(WarehousesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  warehouseId = this.route.snapshot.paramMap.get('id');
  isEditMode = !!this.warehouseId;

  loading = signal(this.isEditMode);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    code: [''],
    name: ['', Validators.required],
    address: [''],
    // Solo aplica en alta — en edición se cambia con "Predeterminar" en el listado.
    isDefault: [false],
  });

  constructor() {
    if (this.warehouseId) {
      this.warehousesService.get(this.warehouseId).subscribe({
        next: warehouse => {
          this.form.patchValue({
            code: warehouse.code ?? '',
            name: warehouse.name,
            address: warehouse.address ?? '',
          });
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo cargar el almacén.');
          this.loading.set(false);
        },
      });
    }
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const request = this.isEditMode
      ? this.warehousesService.update(this.warehouseId!, {
          code: value.code || null,
          name: value.name!,
          address: value.address || null,
        })
      : this.warehousesService.create({
          code: value.code || null,
          name: value.name!,
          address: value.address || null,
          isDefault: value.isDefault!,
        });

    request.subscribe({
      next: () => {
        this.toast.success(this.isEditMode ? 'Almacén actualizado.' : 'Almacén creado.');
        this.router.navigate(['/inventory/warehouses']);
      },
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
