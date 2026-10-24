import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  title = input('');
  size = input<ModalSize>('md');
  close = output<void>();

  panelClass = computed(
    () => `w-full ${SIZE_CLASSES[this.size()]} max-h-[90vh] overflow-y-auto rounded-lg bg-gr-surface p-6 shadow-lg`,
  );
}
