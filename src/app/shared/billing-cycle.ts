// Dos endpoints, dos casings para lo mismo: 'Monthly'/'Quarterly'/'Yearly'
// (plataforma, company-subscription.model.ts) vs 'monthly'/'quarterly'/'yearly'
// (self-service del Admin, company-subscription-view.model.ts). Normalizamos
// igual que subscription-status.ts para cubrir ambos con una sola función.
export function billingCycleLabel(cycle: string): string {
  switch (cycle?.toLowerCase()) {
    case 'monthly':
      return 'Mensual';
    case 'quarterly':
      return 'Trimestral';
    case 'yearly':
      return 'Anual';
    default:
      return cycle;
  }
}
