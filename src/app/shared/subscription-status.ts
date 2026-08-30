// Compartido entre todo lo que muestre un estado de suscripción (empresas,
// company-subscriptions, GET /api/company/subscription) para que el badge se
// vea igual en todos lados. Normalizamos a minúsculas sin guiones bajos porque
// distintos endpoints devuelven distinto casing ('Trial' vs 'trial').
// Confirmado: trial | active | pastdue/past_due | cancelled | expired.
export function subscriptionStatusBadgeClass(status: string): string {
  const key = status?.toLowerCase().replace(/_/g, '') ?? '';
  switch (key) {
    case 'active':
      return 'bg-gr-success-bg text-gr-success';
    case 'trial':
      return 'bg-gr-info-bg text-gr-info';
    case 'pastdue':
      return 'bg-gr-warning-bg text-gr-warning';
    case 'cancelled':
    case 'expired':
      return 'bg-gr-danger-bg text-gr-danger';
    default:
      return 'bg-gr-border-lite text-gr-sub';
  }
}
