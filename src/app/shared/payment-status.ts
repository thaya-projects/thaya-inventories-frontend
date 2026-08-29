// Estado de un SubscriptionPayment: 'Pending' | 'Paid' | 'Failed' | 'Refunded'.
// Distinto del estado de una suscripción (ver subscription-status.ts).
export function paymentStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Paid':
      return 'bg-gr-success-bg text-gr-success';
    case 'Pending':
      return 'bg-gr-warning-bg text-gr-warning';
    case 'Failed':
      return 'bg-gr-danger-bg text-gr-danger';
    case 'Refunded':
      return 'bg-gr-info-bg text-gr-info';
    default:
      return 'bg-gr-border-lite text-gr-sub';
  }
}
