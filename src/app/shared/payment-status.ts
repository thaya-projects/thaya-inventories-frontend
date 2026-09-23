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

// El backend siempre manda el estado en inglés — esto es solo la etiqueta
// visual en español para el administrador, nunca se compara ni se manda de
// vuelta en ningún request.
export function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'Paid':
      return 'Pagado';
    case 'Pending':
      return 'Pendiente';
    case 'Failed':
      return 'Fallido';
    case 'Refunded':
      return 'Reembolsado';
    default:
      return status;
  }
}
