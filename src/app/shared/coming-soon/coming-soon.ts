import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

// Placeholder genérico para rutas ya conectadas en el menú pero sin API
// confirmada todavía — el título/descripción vienen del route `data`, para
// no repetir un componente casi idéntico por cada pantalla pendiente.
@Component({
  selector: 'app-coming-soon',
  templateUrl: './coming-soon.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoon {
  private route = inject(ActivatedRoute);

  title: string = this.route.snapshot.data['title'] ?? 'Próximamente';
  description: string = this.route.snapshot.data['description'] ?? '';
}
