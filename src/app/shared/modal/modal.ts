import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output } from '@angular/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
};

// Ventanas abiertas, la última es la de arriba: Esc cierra solo esa (ej. una confirmación sobre un detalle).
const openModals: Modal[] = [];
let modalSeq = 0;

@Component({
  selector: 'app-modal',
  host: { '(document:keydown.escape)': 'onEscape($event)' },
  templateUrl: './modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  title = input('');
  size = input<ModalSize>('md');
  close = output<void>();

  readonly titleId = `modal-title-${++modalSeq}`;

  constructor() {
    openModals.push(this);
    // La página de atrás no se desplaza mientras hay una ventana abierta.
    document.body.style.overflow = 'hidden';
    inject(DestroyRef).onDestroy(() => {
      const i = openModals.indexOf(this);
      if (i >= 0) openModals.splice(i, 1);
      if (openModals.length === 0) document.body.style.overflow = '';
    });
  }

  onEscape(event: Event) {
    if (openModals[openModals.length - 1] !== this) return;
    event.preventDefault();
    this.close.emit();
  }

  panelClass = computed(
    () => `flex w-full ${SIZE_CLASSES[this.size()]} max-h-[90vh] flex-col overflow-hidden rounded-lg bg-gr-surface shadow-lg`,
  );
}
