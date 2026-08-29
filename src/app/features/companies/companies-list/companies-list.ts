import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { SearchInput } from '../../../shared/search-input/search-input';
import { CompaniesService } from '../../../core/services/companies';
import { Company } from '../../../core/models/company.model';
import { subscriptionStatusBadgeClass } from '../../../shared/subscription-status';

const SEARCH_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-companies-list',
  imports: [DataTable, RouterLink, DatePipe, SearchInput],
  templateUrl: './companies-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompaniesList {
  private companiesService = inject(CompaniesService);

  companies = signal<Company[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  search = signal('');

  private searchTimeout?: ReturnType<typeof setTimeout>;

  private activeTpl = viewChild.required<TemplateRef<{ $implicit: Company }>>('activeTpl');
  private planTpl = viewChild.required<TemplateRef<{ $implicit: Company }>>('planTpl');
  private dateTpl = viewChild.required<TemplateRef<{ $implicit: Company }>>('dateTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: Company }>>('actionsTpl');

  columns = computed<DataTableColumn<Company>[]>(() => [
    { key: 'name', label: 'Nombre' },
    { key: 'isActive', label: 'Activa', cellTemplate: this.activeTpl() },
    { key: 'planCode', label: 'Plan / Estado', cellTemplate: this.planTpl() },
    { key: 'createdAt', label: 'Fecha', cellTemplate: this.dateTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const search = this.search().trim();

    this.companiesService.list(this.page(), this.pageSize(), search ? { search } : undefined).subscribe({
      next: result => {
        this.companies.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(this.mapError(err));
        this.loading.set(false);
      },
    });
  }

  // El backend solo puede fallar acá por auth (401/403) y ninguno trae body
  // propio — el 401/403 "pelado" ya lo documentaron así.
  private mapError(err: HttpErrorResponse): string {
    if (err.status === 403) return 'No tenés permisos para ver el listado de empresas.';
    if (err.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.';
    return 'No se pudo cargar el listado de empresas.';
  }

  statusBadgeClass = subscriptionStatusBadgeClass;

  onSearch(value: string) {
    this.search.set(value);
    this.page.set(1);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  onPageChange(page: number) {
    this.page.set(page);
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }
}
