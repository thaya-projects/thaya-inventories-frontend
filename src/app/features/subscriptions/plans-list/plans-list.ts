import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { SubscriptionPlansService } from '../../../core/services/subscription-plans';
import { SubscriptionPlan } from '../../../core/models/subscription-plan.model';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-plans-list',
  imports: [DataTable, RouterLink],
  templateUrl: './plans-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlansList {
  private plansService = inject(SubscriptionPlansService);

  plans = signal<SubscriptionPlan[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  statusFilter = signal<StatusFilter>('all');
  updatingId = signal<string | null>(null);

  private statusTpl = viewChild.required<TemplateRef<{ $implicit: SubscriptionPlan }>>('statusTpl');
  private priceTpl = viewChild.required<TemplateRef<{ $implicit: SubscriptionPlan }>>('priceTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: SubscriptionPlan }>>('actionsTpl');

  columns = computed<DataTableColumn<SubscriptionPlan>[]>(() => [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'priceMonthly', label: 'Precio mensual', cellTemplate: this.priceTpl() },
    { key: 'maxUsers', label: 'Máx. usuarios' },
    { key: 'isActive', label: 'Estado', cellTemplate: this.statusTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const filter = this.statusFilter();
    const isActive = filter === 'all' ? undefined : filter === 'active';

    this.plansService.list(isActive).subscribe({
      next: result => {
        this.plans.set(result.items);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de planes.');
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
    this.load();
  }

  toggleActive(plan: SubscriptionPlan) {
    this.updatingId.set(plan.id);
    const action = plan.isActive ? this.plansService.deactivate(plan.id) : this.plansService.activate(plan.id);

    action.subscribe({
      next: () => {
        this.updatingId.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.updatingId.set(null);
        this.errorMessage.set(this.mapError(err));
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error. Intenta nuevamente.';
  }
}
