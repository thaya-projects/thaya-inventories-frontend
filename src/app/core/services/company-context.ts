import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CompanyService } from './company';
import { CompanyProfile } from '../models/company-profile.model';
import { CompanySubscriptionView } from '../models/company-subscription-view.model';

// Estado de "mi empresa" (perfil + suscripción) para roles no-SuperAdmin.
// Se carga una sola vez por sesión (desde Shell) y alimenta tanto el filtrado
// del menú (Sidebar) como la pantalla "Mi empresa".
@Injectable({ providedIn: 'root' })
export class CompanyContextService {
  private companyService = inject(CompanyService);

  private companySig = signal<CompanyProfile | null>(null);
  private subscriptionSig = signal<CompanySubscriptionView | null>(null);
  private loaded = false;

  readonly company = this.companySig.asReadonly();
  readonly subscription = this.subscriptionSig.asReadonly();
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.loading.set(true);

    forkJoin({
      company: this.companyService.get(),
      subscription: this.companyService.getSubscription(),
    }).subscribe({
      next: ({ company, subscription }) => {
        this.companySig.set(company);
        this.subscriptionSig.set(subscription);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la información de la empresa.');
        this.loading.set(false);
      },
    });
  }

  // Para reflejar de inmediato en el menú un cambio hecho en "Mi empresa"
  // (ej. activar multi-almacén) sin recargar toda la sesión.
  setCompany(company: CompanyProfile): void {
    this.companySig.set(company);
  }

  // Logout/cambio de cuenta en la misma pestaña — sin esto, load() no vuelve
  // a pedir nada y queda la empresa de la sesión anterior.
  reset(): void {
    this.companySig.set(null);
    this.subscriptionSig.set(null);
    this.loaded = false;
    this.errorMessage.set(null);
  }
}
