import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  OnDestroy,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

let nextId = 0;

const GAP = 8;
const EDGE = 8;
const MAX_WIDTH = 240;

// Ícono "i" con una explicación corta de para qué sirve un campo o indicador.
// Se abre con hover, foco (teclado) o tap (móvil).
//
// El globo se dibuja directo en <body> con posición fija: así ninguna tarjeta
// con overflow-hidden ni ningún modal lo recorta. Sale arriba del ícono, o
// abajo si no hay espacio, y nunca se sale de la pantalla por los costados.
@Component({
  selector: 'app-info-hint',
  template: `
    <span class="inline-flex align-middle" (mouseenter)="show()" (mouseleave)="hide()">
      <button
        #trigger
        type="button"
        class="-m-1 inline-flex cursor-help items-center justify-center rounded-full p-1 text-gr-sub transition-colors duration-150 hover:text-gr-primary focus-visible:text-gr-primary"
        [attr.aria-label]="'Ayuda: ' + text()"
        [attr.aria-expanded]="open()"
        [attr.aria-describedby]="open() ? tooltipId : null"
        (click)="toggle($event)"
        (focus)="show()"
        (blur)="hide()"
        (keydown.escape)="hide()"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.25v3.5" stroke-linecap="round" />
          <circle cx="8" cy="5.1" r="0.55" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoHint implements OnDestroy {
  text = input.required<string>();
  open = signal(false);

  readonly tooltipId = `info-hint-${nextId++}`;

  private readonly document = inject(DOCUMENT);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private tooltip: HTMLElement | null = null;

  // Al hacer scroll o cambiar el tamaño, el ícono se mueve: se cierra en vez
  // de dejar el globo flotando en otro lugar.
  private readonly onViewportChange = () => this.hide();

  show() {
    if (this.open()) return;
    this.open.set(true);

    const tip = this.document.createElement('div');
    tip.id = this.tooltipId;
    tip.setAttribute('role', 'tooltip');
    tip.className =
      'pointer-events-none fixed z-[1000] rounded-sm bg-gr-text px-3 py-2 text-xs leading-snug font-normal tracking-normal normal-case text-white shadow-lg';
    tip.style.maxWidth = `min(${MAX_WIDTH}px, calc(100vw - ${EDGE * 2}px))`;
    tip.textContent = this.text();
    this.document.body.appendChild(tip);
    this.tooltip = tip;
    this.position(tip);

    const view = this.document.defaultView;
    view?.addEventListener('scroll', this.onViewportChange, { capture: true, passive: true });
    view?.addEventListener('resize', this.onViewportChange, { passive: true });
  }

  hide() {
    if (!this.open()) return;
    this.open.set(false);
    this.tooltip?.remove();
    this.tooltip = null;

    const view = this.document.defaultView;
    view?.removeEventListener('scroll', this.onViewportChange, { capture: true });
    view?.removeEventListener('resize', this.onViewportChange);
  }

  toggle(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (this.open()) this.hide();
    else this.show();
  }

  ngOnDestroy() {
    this.hide();
  }

  private position(tip: HTMLElement) {
    const anchor = this.trigger().nativeElement.getBoundingClientRect();
    const viewportWidth = this.document.documentElement.clientWidth;
    const viewportHeight = this.document.documentElement.clientHeight;
    const { width, height } = tip.getBoundingClientRect();

    const fitsAbove = anchor.top - GAP - height >= EDGE;
    const fitsBelow = anchor.bottom + GAP + height <= viewportHeight - EDGE;
    const top = fitsAbove || !fitsBelow ? anchor.top - GAP - height : anchor.bottom + GAP;

    const centered = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.min(Math.max(centered, EDGE), viewportWidth - width - EDGE);

    tip.style.top = `${Math.max(top, EDGE)}px`;
    tip.style.left = `${left}px`;
  }
}
