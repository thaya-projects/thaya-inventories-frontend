import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

// Ícono "i" con una explicación corta de para qué sirve un campo o indicador.
// Se abre con hover, foco (teclado) o tap (móvil).
@Component({
  selector: 'app-info-hint',
  template: `
    <span class="relative inline-flex align-middle" (mouseenter)="open.set(true)" (mouseleave)="open.set(false)">
      <button
        type="button"
        class="-m-1 inline-flex cursor-help items-center justify-center rounded-full p-1 text-gr-sub transition-colors duration-150 hover:text-gr-primary focus-visible:text-gr-primary"
        [attr.aria-label]="'Ayuda: ' + text()"
        [attr.aria-expanded]="open()"
        (click)="open.set(!open()); $event.preventDefault(); $event.stopPropagation()"
        (focus)="open.set(true)"
        (blur)="open.set(false)"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.25v3.5" stroke-linecap="round" />
          <circle cx="8" cy="5.1" r="0.55" fill="currentColor" stroke="none" />
        </svg>
      </button>
      @if (open()) {
        <span
          role="tooltip"
          class="absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-sm bg-gr-text px-3 py-2 text-xs leading-snug font-normal tracking-normal normal-case text-white shadow-lg"
        >{{ text() }}</span>
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoHint {
  text = input.required<string>();
  open = signal(false);
}
