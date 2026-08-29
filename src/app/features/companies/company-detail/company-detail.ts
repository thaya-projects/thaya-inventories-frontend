import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CompaniesService } from '../../../core/services/companies';
import { Company } from '../../../core/models/company.model';
import { subscriptionStatusBadgeClass } from '../../../shared/subscription-status';

@Component({
  selector: 'app-company-detail',
  imports: [RouterLink, DatePipe],
  templateUrl: './company-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyDetail {
  private route = inject(ActivatedRoute);
  private companiesService = inject(CompaniesService);

  company = signal<Company | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  updating = signal(false);

  statusBadgeClass = subscriptionStatusBadgeClass;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.load(id);
    }
  }

  private load(id: string) {
    this.loading.set(true);
    this.companiesService.get(id).subscribe({
      next: company => {
        this.company.set(company);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la información de la empresa.');
        this.loading.set(false);
      },
    });
  }

  toggleActive() {
    const current = this.company();
    if (!current) return;

    this.updating.set(true);
    this.companiesService.setActive(current.id, !current.isActive).subscribe({
      next: updated => {
        this.company.set(updated);
        this.updating.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo actualizar el estado de la empresa.');
        this.updating.set(false);
      },
    });
  }
}
