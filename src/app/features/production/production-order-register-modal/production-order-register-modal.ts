import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { LotCodeField } from '../../../shared/lot-code-field/lot-code-field';
import { ProductionOrdersService } from '../../../core/services/production-orders';
import { ProductsService } from '../../../core/services/products';
import { UnitsOfMeasureService } from '../../../core/services/units-of-measure';
import { LotsService } from '../../../core/services/lots';
import { Product } from '../../../core/models/product.model';
import { UnitOfMeasure } from '../../../core/models/unit-of-measure.model';
import { ProductionOrder, SaveProductionOrderRequest } from '../../../core/models/production-order.model';
import { ToastService } from '../../../shared/toast/toast.service';

const PRODUCTS_PAGE_SIZE = 200;
const UNITS_PAGE_SIZE = 200;

// Vista de confirmación: el usuario elige poco (MP, PT, cantidad, merma) y el
// sistema deriva el resto (kilos netos, producido, costo, precio sugerido,
// lote). "Confirmar producción" hace create + complete en un solo paso — no
// hay estado Planned intermedio salvo que /complete falle (ver submit()).
@Component({
  selector: 'app-production-order-register-modal',
  imports: [Modal, LotCodeField],
  templateUrl: './production-order-register-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionOrderRegisterModal implements OnInit {
  private productionOrdersService = inject(ProductionOrdersService);
  private productsService = inject(ProductsService);
  private unitsService = inject(UnitsOfMeasureService);
  private lotsService = inject(LotsService);
  private toast = inject(ToastService);

  close = output<void>();
  saved = output<ProductionOrder>();

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  products = signal<Product[]>([]);
  units = signal<UnitOfMeasure[]>([]);

  // MP = solo RawMaterial (se compran, se consumen). PT = solo Finished (se
  // producen) — no mezclar: un Finished también puede trackear stock, pero
  // no es materia prima.
  mpProducts = computed(() => this.products().filter(p => p.productType === 'RawMaterial'));
  ptProducts = computed(() => this.products().filter(p => p.productType === 'Finished'));

  today = new Date().toISOString().slice(0, 10);

  // Campos que elige el usuario.
  date = signal(this.today);
  mpProductId = signal('');
  mpQuantity = signal<number | null>(null);
  mpWaste = signal<number | null>(0);
  mpUnitCost = signal<number | null>(null);
  ptProductId = signal('');
  quantityProduced = signal<number | null>(null);
  quantityProducedTouched = signal(false);
  lotCode = signal('');
  generatingLotCode = signal(false);
  referencePrice = signal<number | null>(null);
  margin = signal(30);
  wasteNotes = signal('');

  mpProduct = computed(() => this.products().find(p => p.id === this.mpProductId()) ?? null);
  ptProduct = computed(() => this.products().find(p => p.id === this.ptProductId()) ?? null);
  mpUnit = computed(() => this.units().find(u => u.id === this.mpProduct()?.unitOfMeasureId) ?? null);
  ptUnit = computed(() => this.units().find(u => u.id === this.ptProduct()?.unitOfMeasureId) ?? null);

  // Equivalente en kg de la MP neta (cantidad - merma) — solo si la unidad de
  // la MP es de peso; baseFactor = kg que representa 1 unidad (ej. "qq" = 45.36).
  mpNetKg = computed(() => {
    const unit = this.mpUnit();
    if (!unit || unit.type !== 'Weight') return null;
    const net = (this.mpQuantity() ?? 0) - (this.mpWaste() ?? 0);
    return net * unit.baseFactor;
  });

  // Sugerencia de "producido": kg netos de MP / kg que representa 1 unidad
  // del PT (ej. "Bol23" = 23 kg). Solo si ambas unidades son de peso — si no
  // hay factores confiables, el campo queda vacío y lo carga el usuario a mano.
  suggestedProduced = computed(() => {
    const netKg = this.mpNetKg();
    const ptUnit = this.ptUnit();
    if (netKg == null || !ptUnit || ptUnit.type !== 'Weight' || ptUnit.baseFactor <= 0) return null;
    return netKg / ptUnit.baseFactor;
  });

  mpCost = computed(() => (this.mpQuantity() ?? 0) * (this.mpUnitCost() ?? 0));

  effectiveProduced = computed(() => {
    if (this.quantityProducedTouched()) return this.quantityProduced();
    return this.quantityProduced() ?? this.suggestedProduced();
  });

  unitCostPt = computed(() => {
    const produced = this.effectiveProduced();
    if (!produced) return null;
    return this.mpCost() / produced;
  });

  suggestedPrice = computed(() => {
    const unitCost = this.unitCostPt();
    if (unitCost == null) return null;
    return unitCost * (1 + this.margin() / 100);
  });

  stockAfter = computed(() => {
    const product = this.mpProduct();
    if (!product) return null;
    return product.currentStock - (this.mpQuantity() ?? 0);
  });

  stockNegative = computed(() => this.stockAfter() != null && this.stockAfter()! < 0);

  // Stock insuficiente ya no bloquea confirmar — se puede guardar igual; si
  // de verdad no alcanza, /complete lo rechaza y la orden queda Planned para
  // completarla después de reponer (ver el catch de complete() en submit()).
  canSubmit = computed(() => {
    return (
      !!this.mpProductId() &&
      !!this.ptProductId() &&
      (this.mpQuantity() ?? 0) > 0 &&
      (this.effectiveProduced() ?? 0) > 0 &&
      this.lotCode().trim().length > 0 &&
      this.lotCode().length <= 40 &&
      !this.generatingLotCode() &&
      !this.submitting()
    );
  });

  constructor() {
    // Autocompleta "Producido" con la sugerencia mientras el usuario no la
    // haya tocado a mano — sigue siendo editable en todo momento.
    effect(() => {
      const suggested = this.suggestedProduced();
      if (suggested != null && !this.quantityProducedTouched()) {
        this.quantityProduced.set(Math.round(suggested * 100) / 100);
      }
    });
  }

  ngOnInit(): void {
    forkJoin({
      products: this.productsService.list(1, PRODUCTS_PAGE_SIZE, { isActive: true }),
      units: this.unitsService.list(1, UNITS_PAGE_SIZE, { isActive: true }),
    }).subscribe({
      next: ({ products, units }) => {
        this.products.set(products.items);
        this.units.set(units.items);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar productos/unidades.');
        this.loading.set(false);
      },
    });
  }

  onMpProductChange(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    this.mpProductId.set(id);
    const product = this.products().find(p => p.id === id);
    this.mpUnitCost.set(product?.averageCost ?? 0);
  }

  onMpQuantityInput(event: Event) {
    this.mpQuantity.set(this.parseNumber((event.target as HTMLInputElement).value));
  }

  onMpWasteInput(event: Event) {
    this.mpWaste.set(this.parseNumber((event.target as HTMLInputElement).value));
  }

  onMpUnitCostInput(event: Event) {
    this.mpUnitCost.set(this.parseNumber((event.target as HTMLInputElement).value));
  }

  // (change) real del <select> — al elegir PT, previsualiza el lote y
  // recalcula el vencimiento. No dispara con carga programática, así que no
  // hay riesgo de pisar nada acá (esta vista no tiene modo edición).
  onPtProductChange(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    this.ptProductId.set(id);
    this.quantityProducedTouched.set(false);

    const product = this.products().find(p => p.id === id);
    if (!product) return;

    this.generatingLotCode.set(true);
    this.lotsService.next('Pt', product.id).subscribe({
      next: res => {
        this.generatingLotCode.set(false);
        this.lotCode.set(res.lotCode);
      },
      error: () => {
        this.generatingLotCode.set(false);
        // no bloquea el form — el usuario puede escribir el lote a mano
      },
    });
  }

  onQuantityProducedInput(event: Event) {
    this.quantityProducedTouched.set(true);
    this.quantityProduced.set(this.parseNumber((event.target as HTMLInputElement).value));
  }

  onLotCodeChange(value: string) {
    this.lotCode.set(value);
  }

  // Si el usuario escribe el precio a mano (en vez de usar el sugerido), el
  // margen deja de tener sentido tal cual estaba — lo recalculamos para que
  // siempre refleje el precio que realmente se va a guardar.
  onReferencePriceInput(event: Event) {
    const price = this.parseNumber((event.target as HTMLInputElement).value);
    this.referencePrice.set(price);

    const unitCost = this.unitCostPt();
    if (price != null && unitCost) {
      this.margin.set(Math.round((price / unitCost - 1) * 1000) / 10);
    }
  }

  onMarginInput(event: Event) {
    this.margin.set(this.parseNumber((event.target as HTMLInputElement).value) ?? 30);
  }

  onWasteNotesInput(event: Event) {
    this.wasteNotes.set((event.target as HTMLTextAreaElement).value);
  }

  useSuggestedPrice() {
    const suggested = this.suggestedPrice();
    if (suggested != null) {
      this.referencePrice.set(Math.round(suggested * 100) / 100);
    }
  }

  private parseNumber(raw: string): number | null {
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  private expirationDateFor(product: Product): string | null {
    if (!product.shelfLifeMonths) return null;
    const base = new Date(`${this.date()}T00:00:00`);
    base.setMonth(base.getMonth() + product.shelfLifeMonths);
    return base.toISOString().slice(0, 10);
  }

  // Regenera el lote (sin botón visible) — se usa como recuperación
  // automática si el create falla por lote duplicado.
  private refreshLotCode() {
    const product = this.ptProduct();
    if (!product) return;
    this.lotsService.next('Pt', product.id).subscribe({
      next: res => this.lotCode.set(res.lotCode),
      error: () => { /* deja el código actual — el usuario puede editarlo a mano */ },
    });
  }

  submit() {
    if (!this.canSubmit()) return;

    const mpProduct = this.mpProduct();
    const ptProduct = this.ptProduct();
    if (!mpProduct || !ptProduct) return;

    this.errorMessage.set(null);
    this.submitting.set(true);

    const producedQty = this.effectiveProduced()!;

    const payload: SaveProductionOrderRequest = {
      lotCode: this.lotCode(),
      date: this.date(),
      warehouseId: null,
      productId: ptProduct.id,
      unitOfMeasureId: ptProduct.unitOfMeasureId ?? '',
      quantityProduced: producedQty,
      expirationDate: this.expirationDateFor(ptProduct),
      sanitaryRegistration: null,
      referencePrice: this.referencePrice(),
      wasteQuantity: 0,
      wasteNotes: this.wasteNotes() || null,
      consumptions: [
        {
          productId: mpProduct.id,
          variantId: null,
          unitOfMeasureId: mpProduct.unitOfMeasureId ?? '',
          quantity: this.mpQuantity()!,
          wasteQuantity: this.mpWaste() ?? 0,
          unitCost: this.mpUnitCost(),
        },
      ],
    };

    this.productionOrdersService.create(payload).subscribe({
      next: order => {
        this.productionOrdersService
          .complete(order.id, { quantityProduced: producedQty, wasteQuantity: 0, wasteNotes: this.wasteNotes() || null })
          .subscribe({
            next: completed => {
              this.submitting.set(false);
              this.saved.emit(completed);
            },
            error: (err: HttpErrorResponse) => {
              this.submitting.set(false);
              this.toast.error(this.mapError(err) || 'La orden quedó planificada — complétala desde el detalle.');
              // El create sí funcionó — la orden existe (Planned) y ya es visible en la lista.
              this.saved.emit(order);
            },
          });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
        this.refreshLotCode();
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al registrar la producción.';
  }
}
