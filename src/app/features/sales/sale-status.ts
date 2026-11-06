import { FreightType, SalesOrderStatus } from '../../core/models/sales-order.model';

// Cómo se nombra cada estado de una venta según el tipo de empresa.
//
// Fábrica: flujo de pedido → despacho (el pedido se prepara y sale después).
// Inventario (tienda, distribuidora): la venta "Se lo lleva" se despacha al guardarla
// (venta directa), así que lo normal es verla como "Vendida". Una venta con envío
// queda "Por enviar" hasta que sale; una sin stock queda "Pendiente" hasta que se entrega.

const FACTORY_LABELS: Record<SalesOrderStatus, string> = {
  Pending: 'Pendiente',
  Dispatched: 'Despachada',
  Delivered: 'Entregada',
  Cancelled: 'Cancelada',
};

export function saleStatusLabel(status: string, freightType: FreightType | string, isFactory: boolean): string {
  if (isFactory) return FACTORY_LABELS[status as SalesOrderStatus] ?? status;
  const shipped = freightType !== 'None';
  switch (status) {
    case 'Pending':
      return shipped ? 'Por enviar' : 'Pendiente';
    case 'Dispatched':
      return shipped ? 'Enviada' : 'Vendida';
    default:
      return FACTORY_LABELS[status as SalesOrderStatus] ?? status;
  }
}

// Botón que saca el stock de una venta pendiente.
export function dispatchActionLabel(freightType: FreightType | string, isFactory: boolean): string {
  if (isFactory) return 'Despachar';
  return freightType !== 'None' ? 'Marcar como enviada' : 'Entregar';
}

export const SALE_STATUS_BADGE_CLASS: Record<SalesOrderStatus, string> = {
  Pending: 'bg-gr-warning-bg text-gr-warning',
  Dispatched: 'bg-gr-info-bg text-gr-info',
  Delivered: 'bg-gr-success-bg text-gr-success',
  Cancelled: 'bg-gr-danger-bg text-gr-danger',
};

// En inventario una venta despachada ya está cerrada: se muestra en verde, como hecha.
export function saleStatusBadgeClass(status: string, isFactory: boolean): string {
  if (!isFactory && status === 'Dispatched') return SALE_STATUS_BADGE_CLASS.Delivered;
  return SALE_STATUS_BADGE_CLASS[status as SalesOrderStatus] ?? 'bg-gr-border-lite text-gr-sub';
}
