import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ProductsService } from '../../core/services/products';
import { Product } from '../../core/models/product.model';

const RESULTS_LIMIT = 20;

// "Balón" y "balon" son lo mismo para quien busca.
const normalize = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Buscador de productos (combobox): se escribe parte del nombre o código y se elige.
// Busca en el servidor (sirve con miles de productos) y además en la lista ya cargada,
// ignorando acentos. Teclado: ↑ ↓ para moverse, Enter para elegir, Esc para cerrar.
@Component({
  selector: 'app-product-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block', '(focusout)': 'onFocusOut($event)' },
  template: `
    <div class="relative">
      <svg class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gr-sub" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
      </svg>
      <input
        #box
        type="text" role="combobox" autocomplete="off" [id]="inputId()"
        [attr.aria-expanded]="open()" [attr.aria-controls]="inputId() + '-list'"
        [attr.aria-activedescendant]="open() && results().length ? inputId() + '-opt-' + active() : null"
        [placeholder]="selected() ? '' : placeholder()"
        [value]="open() ? query() : (selected()?.name ?? '')"
        (focus)="onFocus()" (input)="onInput($event)" (keydown)="onKeydown($event)"
        class="w-full rounded-md border bg-gr-surface py-2 pr-3 pl-9 text-sm text-gr-text placeholder-gr-muted transition focus:outline-none focus:ring-2 focus:ring-gr-primary/30"
        [class]="invalid() ? 'border-gr-danger' : 'border-gr-border focus:border-gr-primary'"
      >
    </div>

    @if (open()) {
      <ul
        [id]="inputId() + '-list'" role="listbox"
        class="absolute z-30 mt-1 max-h-72 w-full min-w-72 overflow-y-auto rounded-md border border-gr-border bg-gr-surface py-1 shadow-[0_8px_24px_rgb(29_43_31/0.14)]"
      >
        @for (p of results(); track p.id; let i = $index) {
          <li
            [id]="inputId() + '-opt-' + i" role="option" [attr.aria-selected]="i === active()"
            (mousedown)="$event.preventDefault()" (click)="choose(p)" (mouseenter)="active.set(i)"
            class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
            [class]="i === active() ? 'bg-gr-primary-lite/50' : ''"
          >
            <span class="min-w-0">
              <span class="block truncate font-medium text-gr-text">{{ p.name }}</span>
              <span class="block truncate text-xs text-gr-sub">{{ p.code }}</span>
            </span>
            @if (p.tracksStock) {
              <span class="shrink-0 text-xs text-gr-sub tabular-nums">Stock {{ p.currentStock }}</span>
            }
          </li>
        } @empty {
          <li class="px-3 py-3 text-sm text-gr-sub">
            {{ searching() ? 'Buscando…' : 'Ningún producto coincide con «' + query() + '».' }}
          </li>
        }
      </ul>
    }
  `,
})
export class ProductPicker {
  private productsService = inject(ProductsService);
  private destroyRef = inject(DestroyRef);
  private host = inject(ElementRef<HTMLElement>);

  inputId = input('product-picker');
  placeholder = input('Busca por nombre o código…');
  // Producto ya elegido (para mostrar su nombre). Lo resuelve quien usa el buscador.
  selected = input<Product | null>(null);
  // Productos ya cargados en la pantalla: se filtran al instante mientras llega la búsqueda del servidor.
  preloaded = input<Product[]>([]);
  invalid = input(false);
  picked = output<Product>();

  private box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  open = signal(false);
  query = signal('');
  active = signal(0);
  searching = signal(false);
  private remote = signal<Product[]>([]);
  private search$ = new Subject<string>();

  results = computed(() => {
    const q = normalize(this.query());
    const local = this.preloaded().filter(p => !q || normalize(p.name).includes(q) || normalize(p.code).includes(q));
    const seen = new Set<string>();
    return [...local, ...this.remote()]
      .filter(p => p.isActive !== false && !seen.has(p.id) && seen.add(p.id))
      .slice(0, RESULTS_LIMIT);
  });

  constructor() {
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(q => {
          this.searching.set(true);
          return this.productsService
            .list(1, RESULTS_LIMIT, { search: q || undefined, isActive: true })
            .pipe(catchError(() => of({ items: [] as Product[] })));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(res => {
        this.searching.set(false);
        this.remote.set(res.items);
      });
  }

  onFocus() {
    this.query.set('');
    this.active.set(0);
    this.open.set(true);
    this.search$.next('');
  }

  onInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.active.set(0);
    this.open.set(true);
    this.search$.next(value.trim());
  }

  onKeydown(event: KeyboardEvent) {
    const count = this.results().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open()) this.onFocus();
      else this.active.set(count ? (this.active() + 1) % count : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.set(count ? (this.active() - 1 + count) % count : 0);
    } else if (event.key === 'Enter') {
      if (!this.open()) return;
      event.preventDefault();
      const p = this.results()[this.active()];
      if (p) this.choose(p);
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.open.set(false);
    }
  }

  choose(product: Product) {
    this.open.set(false);
    this.query.set('');
    this.picked.emit(product);
    this.box().nativeElement.blur();
  }

  onFocusOut(event: FocusEvent) {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node)) this.open.set(false);
  }

  focus() {
    this.box().nativeElement.focus();
  }
}
