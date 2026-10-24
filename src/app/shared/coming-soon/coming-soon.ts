import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

// Placeholder genérico para rutas ya conectadas en el menú pero sin API
// confirmada todavía — título/subtítulo/mensaje vienen del route `data`, para
// no repetir un componente casi idéntico por cada pantalla pendiente.
// El texto acá SÍ lo ve el usuario final (SuperAdmin) — nunca jerga de
// desarrollo ("falta confirmar el contrato de la API" y similares).
@Component({
  selector: 'app-coming-soon',
  templateUrl: './coming-soon.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoon {
  private route = inject(ActivatedRoute);

  title: string = this.route.snapshot.data['title'] ?? 'Próximamente';
  description: string = this.route.snapshot.data['description'] ?? '';
  message: string = this.route.snapshot.data['message'] ?? 'Estamos trabajando en esta sección — todavía no está disponible.';
}
