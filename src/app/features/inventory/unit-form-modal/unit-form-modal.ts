import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { UnitsOfMeasureService } from '../../../core/services/units-of-measure';
import { UnitType } from '../../../core/models/unit-of-measure.model';

const TYPES: { value: UnitType; label: string }[] = [
  { value: 'Unit', label: 'Unidad' },
  { value: 'Weight', label: 'Peso' },
  { value: 'Volume', label: 'Volumen' },
  { value: 'Length', label: 'Longitud' },
  { value: 'Time', label: 'Tiempo' },
];

@Component({
  selector: 'app-unit-form-modal',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './unit-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnitFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private unitsService = inject(UnitsOfMeasureService);

  // null/omitido = alta. Con id = edición de esa unidad.
  unitId = input<string | null>(null);
  close = output<void>();
  saved = output<void>();

  types = TYPES;

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    abbreviation: [''],
    type: ['Unit' as UnitType, Validators.required],
    baseFactor: [1, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    const id = this.unitId();
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.unitsService.get(id).subscribe({
      next: unit => {
        this.form.patchValue({
          code: unit.code,
          name: unit.name,
          abbreviation: unit.abbreviation ?? '',
          type: unit.type,
          baseFactor: unit.baseFactor,
        });
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la unidad de medida.');
        this.loading.set(false);
      },
    });
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
      code: value.code!,
      name: value.name!,
      abbreviation: value.abbreviation || undefined,
      type: value.type!,
      baseFactor: value.baseFactor!,
    };

    const id = this.unitId();
    const request = id ? this.unitsService.update(id, payload) : this.unitsService.create(payload);

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
