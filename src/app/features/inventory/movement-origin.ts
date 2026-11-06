// De dónde salió un movimiento de stock. Ventas, compras y producción lo generan solos
// (el backend escribe un motivo fijo); el resto lo cargó alguien a mano.
export type MovementOriginKind = 'sale' | 'purchase' | 'production' | 'manual';

export interface MovementOrigin {
  kind: MovementOriginKind;
  // "Venta #14", "Compra #6", "Producción · Lote PT-01" o la nota manual.
  label: string;
  automatic: boolean;
}

export function movementOrigin(notes: string | null | undefined): MovementOrigin {
  const text = (notes ?? '').trim();
  let m = text.match(/^Despacho de venta #(\d+)/i);
  if (m) return { kind: 'sale', label: `Venta #${m[1]}`, automatic: true };
  m = text.match(/^Recepción de compra #(\d+)/i);
  if (m) return { kind: 'purchase', label: `Compra #${m[1]}`, automatic: true };
  m = text.match(/^Producción\s*-\s*Lote\s*(.+)$/i);
  if (m) return { kind: 'production', label: `Producción · Lote ${m[1]}`, automatic: true };
  return { kind: 'manual', label: text || 'Sin motivo', automatic: false };
}

export const ORIGIN_STYLE: Record<MovementOriginKind, string> = {
  sale: 'bg-gr-primary-lite/50 text-gr-primary-dark',
  purchase: 'bg-gr-info-bg text-gr-info',
  production: 'bg-gr-gold-lite text-gr-gold-dark',
  manual: 'bg-gr-bg text-gr-sub',
};
