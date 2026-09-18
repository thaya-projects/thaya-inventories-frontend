import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CompanyContextService } from '../../core/services/company-context';

// Input de código de lote (producción/compras). El código se autogenera
// desde el componente padre apenas se elige el producto (ver
// onProductChange en cada formulario que lo usa) — este campo solo lo
// muestra y lo deja editable, sin botón propio de generar. Se oculta sola
// si la empresa desactivó lotes explícitamente (usesLots === false) —
// visible por default si el flag no está seteado.
@Component({
  selector: 'app-lot-code-field',
  templateUrl: './lot-code-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LotCodeField {
  private companyContext = inject(CompanyContextService);

  value = input('');
  disabled = input(false);
  // El padre lo prende mientras espera la respuesta de /api/lots/next (ver
  // onProductChange en producción/compras) — el campo se muestra bloqueado
  // con spinner para que no se pise lo que el usuario esté por escribir.
  loading = input(false);
  valueChange = output<string>();

  visible = computed(() => this.companyContext.company()?.settings.usesLots !== false);

  onInput(event: Event) {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
