import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Indicador de pasos para modales tipo wizard (ver CompanyCreateModal,
// PlanFormModal). `steps` son los labels en orden; `currentStep` es 1-based.
@Component({
  selector: 'app-wizard-stepper',
  templateUrl: './wizard-stepper.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WizardStepper {
  steps = input.required<string[]>();
  currentStep = input.required<number>();
}
