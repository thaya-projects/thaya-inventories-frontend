import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Modal } from '../modal/modal';

// Reemplazo genérico de confirm() nativo para acciones irreversibles (cancelar,
// eliminar, etc.) — mismo look & feel que el resto de la app en vez del
// alert() del navegador. Reusar donde haya un confirm() de este tipo.
@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal],
  templateUrl: './confirm-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  title = input('Confirmar');
  message = input.required<string>();
  confirmLabel = input('Confirmar');
  cancelLabel = input('Cancelar');
  // true (default): botón de confirmar en rojo — la mayoría de estos diálogos
  // son para acciones destructivas/irreversibles.
  danger = input(true);
  working = input(false);

  close = output<void>();
  confirmed = output<void>();
}
