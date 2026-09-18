// Confirmado con GET /api/lots/next. Roles: Admin, Warehouse. Es de solo
// lectura — "previsualiza" el próximo código, no inserta nada, se puede
// llamar las veces que haga falta sin saltar números.
export type LotKind = 'Mp' | 'Pt';

export interface NextLotCodeResponse {
  lotCode: string;
}
