import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ProductionOrdersService } from '../../../core/services/production-orders';
import { ProductionOrder, ProductionOrderStatus } from '../../../core/models/production-order.model';
import { CompanyContextService } from '../../../core/services/company-context';
import { ToastService } from '../../../shared/toast/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ProductionOrderFormModal } from '../production-order-form-modal/production-order-form-modal';

const STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  Planned: 'Planificada',
  InProgress: 'En proceso',
  Completed: 'Completada',
  Cancelled: 'Cancelada',
};

const STATUS_BADGE_CLASS: Record<ProductionOrderStatus, string> = {
  Planned: 'bg-gr-warning-bg text-gr-warning',
  InProgress: 'bg-gr-info-bg text-gr-info',
  Completed: 'bg-gr-success-bg text-gr-success',
  Cancelled: 'bg-gr-danger-bg text-gr-danger',
};

@Component({
  selector: 'app-production-order-detail-modal',
  imports: [DatePipe, ReactiveFormsModule, Modal, ConfirmDialog, ProductionOrderFormModal],
  templateUrl: './production-order-detail-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionOrderDetailModal implements OnInit {
  private productionOrdersService = inject(ProductionOrdersService);
  private companyContext = inject(CompanyContextService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  orderId = input.required<string>();
  close = output<void>();
  updated = output<ProductionOrder>();

  order = signal<ProductionOrder | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  working = signal(false);

  editModalOpen = signal(false);
  cancelConfirmOpen = signal(false);

  statusLabel = (status: string) => STATUS_LABELS[status as ProductionOrderStatus] ?? status;
  statusBadgeClass = (status: string) =>
    STATUS_BADGE_CLASS[status as ProductionOrderStatus] ?? 'bg-gr-border-lite text-gr-sub';

  // Editar/Completar/Cancelar solo aplican a Planned/InProgress (Completed/Cancelled quedan cerradas).
  canManage = () => {
    const status = this.order()?.status;
    return status === 'Planned' || status === 'InProgress';
  };

  // Estricto === true (a diferencia de LotCodeField, que es visible-por-defecto)
  // — acá se trata de mostrar una columna de solo lectura con los lotes de MP
  // que asignó FIFO al completar, no de pedir uno.
  usesLots = computed(() => this.companyContext.company()?.settings.usesLots === true);

  // Solo relevante mientras la orden no está Completed/Cancelled.
  hasInsufficientStock = computed(() => {
    const order = this.order();
    return !!order && this.canManage() && order.consumptions.some(c => c.insufficientStock);
  });

  completeModalOpen = signal(false);
  submittingComplete = signal(false);
  completeErrorMessage = signal<string | null>(null);

  completeForm = this.fb.group({
    quantityProduced: [0, [Validators.required, Validators.min(0.0001)]],
    wasteQuantity: [0, [Validators.min(0)]],
    wasteNotes: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.productionOrdersService.get(this.orderId()).subscribe({
      next: order => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la orden de producción.');
        this.loading.set(false);
      },
    });
  }

  openEditModal() {
    this.editModalOpen.set(true);
  }

  closeEditModal() {
    this.editModalOpen.set(false);
  }

  onOrderUpdated(order: ProductionOrder) {
    this.order.set(order);
    this.editModalOpen.set(false);
    this.toast.success('Orden de producción actualizada.');
    this.updated.emit(order);
  }

  openCompleteModal() {
    const current = this.order();
    if (!current) return;

    this.completeErrorMessage.set(null);
    this.completeForm.reset({
      quantityProduced: current.quantityProduced,
      wasteQuantity: current.wasteQuantity,
      wasteNotes: current.wasteNotes ?? '',
    });
    this.completeModalOpen.set(true);
  }

  closeCompleteModal() {
    if (this.submittingComplete()) return;
    this.completeModalOpen.set(false);
  }

  submitComplete() {
    if (this.completeForm.invalid) {
      this.completeForm.markAllAsTouched();
      return;
    }

    const value = this.completeForm.getRawValue();
    this.completeErrorMessage.set(null);
    this.submittingComplete.set(true);

    this.productionOrdersService
      .complete(this.orderId(), {
        quantityProduced: value.quantityProduced!,
        wasteQuantity: value.wasteQuantity ?? 0,
        wasteNotes: value.wasteNotes || null,
      })
      .subscribe({
        next: order => {
          this.submittingComplete.set(false);
          this.completeModalOpen.set(false);
          this.order.set(order);
          this.toast.success('Producción completada — stock actualizado.');
          this.updated.emit(order);
        },
        error: (err: HttpErrorResponse) => {
          this.submittingComplete.set(false);
          this.completeErrorMessage.set(this.mapError(err));
        },
      });
  }

  askCancel() {
    this.cancelConfirmOpen.set(true);
  }

  closeCancelConfirm() {
    if (this.working()) return;
    this.cancelConfirmOpen.set(false);
  }

  confirmCancel() {
    this.working.set(true);
    this.productionOrdersService.cancel(this.orderId()).subscribe({
      next: () => {
        this.working.set(false);
        this.cancelConfirmOpen.set(false);
        this.toast.success('Orden de producción cancelada.');
        // cancel() no devuelve la orden (204) — releer para reflejar el
        // nuevo status acá y avisarle al listado con el dato ya actualizado.
        this.productionOrdersService.get(this.orderId()).subscribe(order => {
          this.order.set(order);
          this.updated.emit(order);
        });
      },
      error: (err: HttpErrorResponse) => {
        this.working.set(false);
        this.toast.error(this.mapError(err));
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }
    return 'Ocurrió un error. Intenta nuevamente.';
  }
}
