import { ChangeDetectionStrategy, Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DataTable, DataTableColumn } from '../../../shared/data-table/data-table';
import { PaymentMethodsService } from '../../../core/services/payment-methods';
import { PaymentMethod } from '../../../core/models/payment-method.model';
import { PaymentMethodFormModal } from '../payment-method-form-modal/payment-method-form-modal';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { ToastService } from '../../../shared/toast/toast.service';

const TYPE_LABELS: Record<string, string> = {
  Cash: 'Efectivo',
  Qr: 'QR',
  Transfer: 'Transferencia',
  Card: 'Tarjeta',
  Gateway: 'Pasarela',
};

@Component({
  selector: 'app-payment-methods-list',
  imports: [DataTable, PaymentMethodFormModal, ConfirmDialog],
  templateUrl: './payment-methods-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodsList {
  private paymentMethodsService = inject(PaymentMethodsService);
  private toast = inject(ToastService);

  methods = signal<PaymentMethod[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  updatingId = signal<string | null>(null);

  showFormModal = signal(false);
  editingMethodId = signal<string | null>(null);
  toggleTarget = signal<PaymentMethod | null>(null);

  typeLabel = (type: string) => TYPE_LABELS[type] ?? type;

  private typeTpl = viewChild.required<TemplateRef<{ $implicit: PaymentMethod }>>('typeTpl');
  private defaultTpl = viewChild.required<TemplateRef<{ $implicit: PaymentMethod }>>('defaultTpl');
  private activeTpl = viewChild.required<TemplateRef<{ $implicit: PaymentMethod }>>('activeTpl');
  private actionsTpl = viewChild.required<TemplateRef<{ $implicit: PaymentMethod }>>('actionsTpl');

  columns = computed<DataTableColumn<PaymentMethod>[]>(() => [
    { key: 'name', label: 'Nombre' },
    { key: 'type', label: 'Tipo', cellTemplate: this.typeTpl() },
    { key: 'isDefault', label: 'Predeterminado', cellTemplate: this.defaultTpl() },
    { key: 'isActive', label: 'Estado', cellTemplate: this.activeTpl() },
    { key: 'id', label: '', cellTemplate: this.actionsTpl() },
  ]);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.paymentMethodsService.list().subscribe({
      next: methods => {
        this.methods.set(methods);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de métodos de pago.');
        this.loading.set(false);
      },
    });
  }

  openCreateModal() {
    this.editingMethodId.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(method: PaymentMethod) {
    this.editingMethodId.set(method.id);
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  onMethodSaved() {
    this.showFormModal.set(false);
    this.toast.success(this.editingMethodId() ? 'Método de pago actualizado.' : 'Método de pago creado.');
    this.load();
  }

  askToggleActive(method: PaymentMethod) {
    this.toggleTarget.set(method);
  }

  closeToggleConfirm() {
    if (this.updatingId()) return;
    this.toggleTarget.set(null);
  }

  confirmToggleActive() {
    const method = this.toggleTarget();
    if (!method) return;

    this.updatingId.set(method.id);
    const action = method.isActive
      ? this.paymentMethodsService.deactivate(method.id)
      : this.paymentMethodsService.activate(method.id);

    action.subscribe({
      next: () => {
        this.updatingId.set(null);
        this.toggleTarget.set(null);
        this.toast.success(method.isActive ? 'Método de pago desactivado.' : 'Método de pago activado.');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.updatingId.set(null);
        this.toast.error(this.mapError(err));
      },
    });
  }

  setDefault(method: PaymentMethod) {
    this.updatingId.set(method.id);
    this.paymentMethodsService.setDefault(method.id).subscribe({
      next: () => {
        this.updatingId.set(null);
        this.toast.success(`"${method.name}" es ahora el método predeterminado.`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.updatingId.set(null);
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
