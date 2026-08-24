import { ChangeDetectionStrategy, Component } from '@angular/core';

// TODO: placeholder mínimo, solo para validar la ruta y la navegación desde
// el login. El dashboard real se construye en otra rama.
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {}
