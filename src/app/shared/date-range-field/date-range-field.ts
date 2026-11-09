import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { merge } from 'rxjs';

const PANEL_HEIGHT = 500;
const MONTH_WIDTH = 266;
const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
const START_TIMES = ['00:00', '08:00', '12:00'];
const END_TIMES = ['12:00', '18:00', '23:59'];

type Side = 'start' | 'end';

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toValue = (d: Date) => `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const at = (d: Date, time: string) => {
  const [h, m] = time.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
};

// "2026-11-09T14:51" → Date local (mismo formato que <input type="datetime-local">).
function parse(value: string | null | undefined): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

// "9 nov" (o "9 nov 2027" si no es este año).
function formatDay(d: Date): string {
  return d
    .toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
    .replace(/\./g, '');
}

// Rango de fechas con hora en un solo campo: se toca el día de inicio y luego el de fin,
// y el tramo queda pintado en el calendario. Escribe en dos FormControl con el formato
// "YYYY-MM-DDTHH:mm" (hora local) o '' — los dos extremos son opcionales:
// sin inicio = desde ya, sin fin = hasta que se quite.
@Component({
  selector: 'app-date-range-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(document:mousedown)': 'onOutside($event)',
    '(window:resize)': 'place()',
    '(keydown.escape)': 'onEscape($event)',
  },
  template: `
    <div
      class="flex items-center rounded-md border bg-gr-surface transition"
      [class]="open() ? 'border-gr-primary ring-2 ring-gr-primary/30' : 'border-gr-border hover:border-gr-primary-mid focus-within:border-gr-primary focus-within:ring-2 focus-within:ring-gr-primary/30'"
    >
      <button
        type="button" [id]="inputId()" (click)="toggle()" [attr.aria-expanded]="open()" aria-haspopup="dialog"
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm focus:outline-none"
      >
        <svg class="h-4 w-4 shrink-0 text-gr-sub" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>
        </svg>
        @if (start() || end()) {
          <span class="flex min-w-0 items-center gap-2 text-gr-text">
            @if (start(); as s) {
              <span class="truncate">{{ fmt(s) }} <b class="font-semibold tabular-nums">{{ time(s) }}</b></span>
            } @else {
              <span class="shrink-0 text-gr-sub">Desde ya</span>
            }
            <svg class="h-3.5 w-3.5 shrink-0 text-gr-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
            @if (end(); as e) {
              <span class="truncate">{{ fmt(e) }} <b class="font-semibold tabular-nums">{{ time(e) }}</b></span>
            } @else {
              <span class="shrink-0 text-gr-sub">sin fin</span>
            }
          </span>
        } @else {
          <span class="truncate text-gr-muted">{{ placeholder() }}</span>
        }
      </button>
      @if (start() || end()) {
        <button type="button" (click)="clearAll()" aria-label="Quitar fechas" class="mr-1.5 cursor-pointer rounded p-1 text-gr-muted transition hover:bg-gr-bg hover:text-gr-danger">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      }
    </div>

    @if (open()) {
      <div
        role="dialog" aria-label="Elegir fechas"
        class="fixed z-50 rounded-lg border border-gr-border bg-gr-surface p-4 shadow-[0_12px_32px_rgb(29_43_31/0.16)] animate-fade-up"
        [style.width.px]="panelWidth()" [style.left.px]="pos().left" [style.top.px]="pos().top" [style.bottom.px]="pos().bottom"
      >
        <!-- Extremos: cuál se está eligiendo + su hora -->
        <div class="grid grid-cols-2 gap-2">
          @for (side of sides; track side) {
            @let value = side === 'start' ? start() : end();
            <div
              class="rounded-md border px-3 py-2 transition"
              [class]="editing() === side ? 'border-gr-primary bg-gr-primary-lite/60 ring-1 ring-gr-primary' : 'border-gr-border'"
            >
              <button type="button" (click)="editing.set(side)" class="block w-full cursor-pointer text-left" [attr.aria-pressed]="editing() === side">
                <span class="block text-xs" [class]="editing() === side ? 'font-semibold text-gr-primary' : 'text-gr-sub'">
                  {{ side === 'start' ? 'Empieza' : 'Termina' }}
                </span>
                <span class="block truncate text-sm font-semibold" [class]="value ? 'text-gr-text' : 'text-gr-muted'">
                  {{ value ? fmtLong(value) : (side === 'start' ? 'Desde ya' : 'Sin fin') }}
                </span>
              </button>
              @if (value) {
                <div class="mt-1.5 flex items-center gap-1">
                  <input
                    type="time" [value]="time(value)" (change)="onTime(side, $event)" (focus)="editing.set(side)"
                    [attr.aria-label]="side === 'start' ? 'Hora de inicio' : 'Hora de fin'"
                    class="w-[5.5rem] rounded border border-gr-border bg-gr-surface px-1.5 py-0.5 text-sm text-gr-text tabular-nums focus:border-gr-primary focus:outline-none focus:ring-2 focus:ring-gr-primary/30"
                  >
                  @for (t of side === 'start' ? startTimes : endTimes; track t) {
                    <button
                      type="button" (click)="setTime(side, t)"
                      class="cursor-pointer rounded px-1.5 py-0.5 text-xs tabular-nums transition"
                      [class]="t === time(value) ? 'bg-gr-primary font-semibold text-white' : 'text-gr-sub hover:bg-gr-surface hover:text-gr-text'"
                    >{{ t }}</button>
                  }
                  <button type="button" (click)="clear(side)" [attr.aria-label]="side === 'start' ? 'Quitar inicio' : 'Quitar fin'" class="ml-auto cursor-pointer rounded p-1 text-gr-muted transition hover:text-gr-danger">
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
                  </button>
                </div>
              }
            </div>
          }
        </div>

        <!-- Atajos de rango -->
        <div class="mt-3 flex flex-wrap gap-1.5">
          @for (p of presets(); track p.label) {
            <button
              type="button" (click)="applyPreset(p.start, p.end)"
              class="cursor-pointer rounded-full border border-gr-border px-2.5 py-1 text-xs font-medium text-gr-text transition hover:border-gr-primary hover:bg-gr-primary-lite"
            >{{ p.label }}</button>
          }
        </div>

        <!-- Meses -->
        <div class="relative mt-3 flex gap-6" (mouseleave)="hover.set(null)">
          <button type="button" (click)="moveMonth(-1)" aria-label="Mes anterior" class="absolute top-0 left-0 cursor-pointer rounded p-1 text-gr-sub transition hover:bg-gr-bg hover:text-gr-text">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>
          </button>
          <button type="button" (click)="moveMonth(1)" aria-label="Mes siguiente" class="absolute top-0 right-0 cursor-pointer rounded p-1 text-gr-sub transition hover:bg-gr-bg hover:text-gr-text">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
          </button>

          @for (m of months(); track m.key) {
            <div class="min-w-0 flex-1">
              <p class="mb-2 py-0.5 text-center text-sm font-semibold text-gr-text first-letter:uppercase">{{ m.label }}</p>
              <div class="grid grid-cols-7">
                @for (w of weekdays; track w) {
                  <span class="pb-1 text-center text-[11px] font-medium text-gr-muted">{{ w }}</span>
                }
                @for (d of m.days; track $index) {
                  @if (d) {
                    <div class="my-px flex h-9 items-center justify-center" [style.background]="band(d.key)">
                      <button
                        type="button" (click)="pickDay(d.date)" (mouseenter)="hover.set(d.key)" (focus)="hover.set(d.key)"
                        [attr.aria-label]="d.aria" [attr.aria-pressed]="d.key === startKey() || d.key === endKey()"
                        class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-sm tabular-nums transition"
                        [class]="dayClass(d.key, d.today, d.past)"
                      >{{ d.date.getDate() }}</button>
                    </div>
                  } @else {
                    <span></span>
                  }
                }
              </div>
            </div>
          }
        </div>

        <div class="mt-3 flex items-center justify-between gap-3 border-t border-gr-border-lite pt-3">
          @if (invalid()) {
            <p class="text-xs font-medium text-gr-danger">El fin tiene que ser después del inicio.</p>
          } @else {
            <p class="text-xs text-gr-sub">{{ editing() === 'start' ? 'Toca el día en que empieza.' : 'Ahora toca el día en que termina.' }}</p>
          }
          <button type="button" (click)="close()" class="shrink-0 cursor-pointer rounded-md bg-gr-primary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-gr-primary-dark">Listo</button>
        </div>
      </div>
    }
  `,
})
export class DateRangeField {
  private host = inject(ElementRef<HTMLElement>);

  from = input.required<FormControl<string | null>>();
  to = input.required<FormControl<string | null>>();
  inputId = input('date-range');
  placeholder = input('Elegir fechas');

  readonly sides: Side[] = ['start', 'end'];
  readonly weekdays = WEEKDAYS;
  readonly startTimes = START_TIMES;
  readonly endTimes = END_TIMES;
  readonly fmt = formatDay;
  readonly fmtLong = (d: Date) => `${d.toLocaleDateString('es-BO', { weekday: 'short' }).replace(/\./g, '')} ${formatDay(d)}`;
  readonly time = hhmm;

  start = signal<Date | null>(null);
  end = signal<Date | null>(null);
  open = signal(false);
  editing = signal<Side>('start');
  hover = signal<string | null>(null);
  view = signal(new Date());
  pos = signal<{ left: number; top: number | null; bottom: number | null }>({ left: 0, top: 0, bottom: null });
  private wide = signal(true);

  private onScroll = () => this.place();

  constructor() {
    // Los controles son la fuente de verdad (el formulario los rellena al editar un producto).
    effect(onCleanup => {
      const from = this.from();
      const to = this.to();
      const sync = () => {
        this.start.set(parse(from.value));
        this.end.set(parse(to.value));
      };
      sync();
      const sub = merge(from.valueChanges, to.valueChanges).subscribe(sync);
      onCleanup(() => sub.unsubscribe());
    });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', this.onScroll, true));
  }

  startKey = computed(() => (this.start() ? dayKey(this.start()!) : null));
  endKey = computed(() => (this.end() ? dayKey(this.end()!) : null));
  invalid = computed(() => !!this.start() && !!this.end() && this.end()! <= this.start()!);
  panelWidth = computed(() => (this.wide() ? MONTH_WIDTH * 2 + 24 + 34 : Math.min(MONTH_WIDTH + 34, window.innerWidth - 16)));

  // Fin "provisional" mientras se pasa el ratón buscando el día de fin.
  private previewEnd = computed(() => {
    const s = this.startKey();
    const h = this.hover();
    if (this.editing() !== 'end' || !s || !h || h < s) return null;
    return h;
  });

  // Uno o dos meses; los huecos antes del día 1 van vacíos para no repetir días entre meses.
  months = computed(() => {
    const v = this.view();
    const today = dayKey(new Date());
    return Array.from({ length: this.wide() ? 2 : 1 }, (_, i) => {
      const first = new Date(v.getFullYear(), v.getMonth() + i, 1);
      const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const blanks = (first.getDay() + 6) % 7;
      const days = [
        ...Array.from({ length: blanks }, () => null),
        ...Array.from({ length: count }, (_, n) => {
          const date = new Date(first.getFullYear(), first.getMonth(), n + 1);
          const key = dayKey(date);
          return {
            date, key,
            today: key === today,
            past: key < today,
            aria: date.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }),
          };
        }),
      ];
      return { key: dayKey(first), label: first.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }), days };
    });
  });

  presets = computed(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const saturday = addDays(today, today.getDay() === 0 ? -1 : 6 - today.getDay());
    return [
      { label: 'Solo hoy', start: at(today, '00:00'), end: at(today, '23:59') },
      { label: 'Este fin de semana', start: at(saturday, '00:00'), end: at(addDays(saturday, 1), '23:59') },
      { label: '7 días', start: at(today, '00:00'), end: at(addDays(today, 6), '23:59') },
      { label: 'Hasta fin de mes', start: at(today, '00:00'), end: at(new Date(today.getFullYear(), today.getMonth() + 1, 0), '23:59') },
    ];
  });

  // ── Pintado del rango ─────────────────────────────────────────────────
  // La franja va en la celda (de borde a borde) y el círculo del extremo encima.
  band(key: string): string | null {
    const s = this.startKey();
    const e = this.endKey() ?? this.previewEnd();
    if (!s || !e || e <= s || key < s || key > e) return null;
    const tint = this.endKey() ? 'var(--color-gr-primary-lite)' : 'rgb(235 242 236 / 0.6)';
    if (key === s) return `linear-gradient(to right, transparent 50%, ${tint} 50%)`;
    if (key === e) return `linear-gradient(to left, transparent 50%, ${tint} 50%)`;
    return tint;
  }

  dayClass(key: string, today: boolean, past: boolean): string {
    if (key === this.startKey() || key === this.endKey()) return 'bg-gr-primary font-semibold text-white';
    if (key === this.previewEnd()) return 'bg-gr-surface font-semibold text-gr-primary ring-2 ring-gr-primary';
    const base = today ? 'font-semibold text-gr-primary ring-1 ring-gr-primary' : past ? 'text-gr-muted' : 'text-gr-text';
    return `${base} hover:bg-gr-primary-lite`;
  }

  // ── Panel ─────────────────────────────────────────────────────────────
  toggle() {
    if (this.open()) return this.close();
    this.editing.set(this.start() && !this.end() ? 'end' : 'start');
    const base = this.start() ?? this.end() ?? new Date();
    this.view.set(new Date(base.getFullYear(), base.getMonth(), 1));
    this.open.set(true);
    this.place();
    // El modal tiene su propio scroll: el panel es fixed y se recoloca al desplazarse.
    document.addEventListener('scroll', this.onScroll, true);
  }

  close() {
    if (!this.open()) return;
    this.open.set(false);
    this.hover.set(null);
    document.removeEventListener('scroll', this.onScroll, true);
    this.from().markAsTouched();
    this.to().markAsTouched();
  }

  // Debajo del campo; si no cabe, encima. Nunca fuera de la ventana por los lados.
  place() {
    if (!this.open()) return;
    this.wide.set(window.innerWidth >= 680);
    const rect = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - this.panelWidth() - 8));
    const below = window.innerHeight - rect.bottom >= PANEL_HEIGHT || rect.top < PANEL_HEIGHT;
    this.pos.set(below
      ? { left, top: rect.bottom + 6, bottom: null }
      : { left, top: null, bottom: window.innerHeight - rect.top + 6 });
  }

  onOutside(event: MouseEvent) {
    if (this.open() && !(this.host.nativeElement as HTMLElement).contains(event.target as Node)) this.close();
  }

  // Esc cierra el calendario, no el modal de detrás.
  onEscape(event: Event) {
    if (!this.open()) return;
    event.stopPropagation();
    this.close();
  }

  moveMonth(delta: number) {
    const v = this.view();
    this.view.set(new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  // ── Selección ─────────────────────────────────────────────────────────
  // Primer toque = inicio, segundo = fin. Un fin anterior al inicio pasa a ser el nuevo inicio.
  pickDay(day: Date) {
    const start = this.start();
    if (this.editing() === 'end' && start && dayKey(day) >= dayKey(start)) {
      this.write('end', at(day, this.end() ? hhmm(this.end()!) : '23:59'));
      return;
    }
    const next = at(day, start ? hhmm(start) : '00:00');
    this.write('start', next);
    if (this.end() && this.end()! <= next) this.write('end', null);
    this.editing.set('end');
  }

  setTime(side: Side, time: string) {
    const current = side === 'start' ? this.start() : this.end();
    if (current) this.write(side, at(current, time));
  }

  onTime(side: Side, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.setTime(side, value);
  }

  applyPreset(start: Date, end: Date) {
    this.write('start', start);
    this.write('end', end);
    this.close();
  }

  clear(side: Side) {
    this.write(side, null);
    this.editing.set(side);
  }

  clearAll() {
    this.write('start', null);
    this.write('end', null);
    this.close();
  }

  private write(side: Side, date: Date | null) {
    const control = side === 'start' ? this.from() : this.to();
    control.setValue(date ? toValue(date) : '');
    control.markAsDirty();
  }
}
