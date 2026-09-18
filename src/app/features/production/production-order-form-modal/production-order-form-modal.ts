import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { LotCodeField } from '../../../shared/lot-code-field/lot-code-field';
import { ProductionOrdersService } from '../../../core/services/production-orders';
import { ProductsService } from '../../../core/services/products';
import { LotsService } from '../../../core/services/lots';
import { CompanyContextService } from '../../../core/services/company-context';
import { Product } from '../../../core/models/product.model';
import { ProductionOrder, SaveProductionOrderRequest } from '../../../core/models/production-order.model';

const PRODUCTS_PAGE_SIZE = 200;

interface ConsumptionSeed {
  id?: string | null;
  productId: string;
  unitOfMeasureId: string;
  quantity: number;
  wasteQuantity: number;
  unitCost: number | null;
}

@Component({
  selector: 'app-production-order-form-modal',
  imports: [ReactiveFormsModule, Modal, LotCodeField],
  templateUrl: './production-order-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionOrderFormModal implements OnInit {
  private fb = inject(FormBuilder);
  private productionOrdersService = inject(ProductionOrdersService);
  private productsService = inject(ProductsService);
  private lotsService = inject(LotsService);
  private companyContext = inject(CompanyContextService);

  // null/omitido = alta. Con id = edición de esa orden (solo si está Planned/InProgress).
  orderId = input<string | null>(null);
  close = output<void>();
  saved = output<ProductionOrder>();

  usesLots = computed(() => this.companyContext.company()?.settings.usesLots !== false);

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  products = signal<Product[]>([]);
  // Solo productos terminados para el combo de "Producto a producir".
  finishedProducts = signal<Product[]>([]);
  // Solo materia prima para el combo de consumos — un Finished también puede
  // trackear stock, pero no es materia prima.
  mpProducts = computed(() => this.products().filter(p => p.productType === 'RawMaterial'));

  today = new Date().toISOString().slice(0, 10);

  form = this.fb.group({
    lotCode: ['', Validators.maxLength(40)],
    date: [this.today, Validators.required],
    productId: ['', Validators.required],
    unitOfMeasureId: [''],
    quantityProduced: [0, [Validators.required, Validators.min(0.0001)]],
    expirationDate: [''],
    sanitaryRegistration: [''],
    referencePrice: [null as number | null],
    wasteQuantity: [0, [Validators.min(0)]],
    wasteNotes: [''],
    consumptions: this.fb.array<FormGroup>([]),
  });

  get consumptionsArray(): FormArray {
    return this.form.get('consumptions') as FormArray;
  }

  ngOnInit(): void {
    this.productsService.list(1, PRODUCTS_PAGE_SIZE, { isActive: true }).subscribe({
      next: result => {
        this.products.set(result.items);
        this.finishedProducts.set(result.items.filter(p => p.productType === 'Finished'));

        const id = this.orderId();
        if (id) {
          this.loadOrder(id);
        } else {
          this.addConsumption();
          this.loading.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los productos.');
        this.loading.set(false);
      },
    });
  }

  private loadOrder(id: string) {
    this.productionOrdersService.get(id).subscribe({
      next: order => {
        this.form.patchValue({
          lotCode: order.lotCode,
          date: order.date?.slice(0, 10) ?? this.today,
          productId: order.productId,
          unitOfMeasureId: order.unitOfMeasureId,
          quantityProduced: order.quantityProduced,
          expirationDate: order.expirationDate?.slice(0, 10) ?? '',
          sanitaryRegistration: order.sanitaryRegistration ?? '',
          referencePrice: order.referencePrice,
          wasteQuantity: order.wasteQuantity,
          wasteNotes: order.wasteNotes ?? '',
        });

        for (const c of order.consumptions) {
          this.addConsumption({
            id: c.id,
            productId: c.productId,
            unitOfMeasureId: c.unitOfMeasureId,
            quantity: c.quantity,
            wasteQuantity: c.wasteQuantity,
            unitCost: c.unitCost,
          });
        }

        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la orden de producción.');
        this.loading.set(false);
      },
    });
  }

  // (change) del <select> — solo dispara con interacción real del usuario,
  // nunca con el patchValue de loadOrder(), así que no pisa el lote ya
  // cargado al editar una orden existente.
  generatingLotCode = signal(false);

  onProductChange() {
    const product = this.finishedProducts().find(p => p.id === this.form.controls.productId.value);
    this.form.controls.unitOfMeasureId.setValue(product?.unitOfMeasureId ?? '');

    // Vencimiento = fecha de producción + vida útil del producto (en meses).
    // Si el producto no tiene vida útil configurada, lo carga el usuario a mano.
    if (product?.shelfLifeMonths) {
      const base = this.form.controls.date.value ? new Date(`${this.form.controls.date.value}T00:00:00`) : new Date();
      base.setMonth(base.getMonth() + product.shelfLifeMonths);
      this.form.controls.expirationDate.setValue(base.toISOString().slice(0, 10));
    } else {
      this.form.controls.expirationDate.setValue('');
    }

    if (this.usesLots() && product) {
      this.generatingLotCode.set(true);
      this.lotsService.next('Pt', product.id).subscribe({
        next: res => {
          this.generatingLotCode.set(false);
          this.form.controls.lotCode.setValue(res.lotCode);
        },
        error: () => {
          this.generatingLotCode.set(false);
          // no bloquea el form — el usuario puede escribir el lote a mano
        },
      });
    }
  }

  private newConsumptionGroup(seed?: ConsumptionSeed): FormGroup {
    return this.fb.group({
      id: [seed?.id ?? null],
      productId: [seed?.productId ?? '', Validators.required],
      unitOfMeasureId: [seed?.unitOfMeasureId ?? ''],
      quantity: [seed?.quantity ?? 1, [Validators.required, Validators.min(0.0001)]],
      wasteQuantity: [seed?.wasteQuantity ?? 0, [Validators.min(0)]],
      unitCost: [seed?.unitCost ?? null],
    });
  }

  addConsumption(seed?: ConsumptionSeed) {
    this.consumptionsArray.push(this.newConsumptionGroup(seed));
  }

  removeConsumption(index: number) {
    this.consumptionsArray.removeAt(index);
  }

  onConsumptionProductChange(index: number) {
    const group = this.consumptionsArray.at(index);
    const product = this.products().find(p => p.id === group.get('productId')!.value);
    group.get('unitOfMeasureId')!.setValue(product?.unitOfMeasureId ?? '');
  }

  submit() {
    if (this.consumptionsArray.length === 0) {
      this.errorMessage.set('Agrega al menos un insumo (materia prima).');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    const id = this.orderId();

    const payload: SaveProductionOrderRequest = {
      lotCode: value.lotCode || null,
      date: value.date!,
      warehouseId: null,
      productId: value.productId!,
      unitOfMeasureId: value.unitOfMeasureId || '',
      quantityProduced: value.quantityProduced!,
      expirationDate: value.expirationDate || null,
      sanitaryRegistration: value.sanitaryRegistration || null,
      referencePrice: value.referencePrice,
      wasteQuantity: value.wasteQuantity ?? 0,
      wasteNotes: value.wasteNotes || null,
      consumptions: value.consumptions!.map((c: any) => ({
        ...(id ? { id: c.id ?? null } : {}),
        productId: c.productId,
        variantId: null,
        unitOfMeasureId: c.unitOfMeasureId || '',
        quantity: c.quantity,
        wasteQuantity: c.wasteQuantity ?? 0,
        unitCost: c.unitCost,
      })),
    };

    const request = id ? this.productionOrdersService.update(id, payload) : this.productionOrdersService.create(payload);

    request.subscribe({
      next: order => this.saved.emit(order),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.mapError(err));
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error al guardar la orden de producción.';
  }
}
