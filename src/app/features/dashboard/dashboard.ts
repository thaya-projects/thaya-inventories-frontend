import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { CompaniesService } from '../../core/services/companies';
import { Company } from '../../core/models/company.model';

const TRIAL_WARNING_DAYS = 7;

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, StatCard],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private companiesService = inject(CompaniesService);

  private companies = signal<Company[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  activeCount = computed(() => this.companies().filter(c => c.isActive).length);

  trialsExpiringCount = computed(() => {
    const now = Date.now();
    const limit = now + TRIAL_WARNING_DAYS * 24 * 60 * 60 * 1000;

    return this.companies().filter(c => {
      if (!c.trialEndsAt) return false;
      const endsAt = new Date(c.trialEndsAt).getTime();
      return endsAt >= now && endsAt <= limit;
    }).length;
  });

  pastDueCount = computed(() =>
    this.companies().filter(c => {
      const status = c.subscriptionStatus?.toLowerCase().replace(/_/g, '') ?? '';
      return status.includes('pastdue') || status.includes('expired');
    }).length,
  );

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);

    // TODO: no hay un endpoint de estadísticas de plataforma todavía — traemos
    // un lote grande de empresas y calculamos los conteos acá. Reemplazar por
    // un endpoint dedicado (ej. GET /platform/dashboard) cuando exista.
    this.companiesService.list(1, 1000).subscribe({
      next: result => {
        this.companies.set(result.items);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los datos del dashboard.');
        this.loading.set(false);
      },
    });
  }
}
