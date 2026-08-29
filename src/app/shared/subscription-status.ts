// Compartido entre todo lo que muestre un estado de suscripción (empresas,
// company-subscriptions) para que el badge se vea igual en todos lados.
// Confirmado: 'Trial' | 'Active' | 'PastDue' | 'Cancelled' | 'Expired'.
export function subscriptionStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Active':
      return 'bg-gr-success-bg text-gr-success';
    case 'Trial':
      return 'bg-gr-info-bg text-gr-info';
    case 'PastDue':
      return 'bg-gr-warning-bg text-gr-warning';
    case 'Cancelled':
    case 'Expired':
      return 'bg-gr-danger-bg text-gr-danger';
    default:
      return 'bg-gr-border-lite text-gr-sub';
  }
}
