import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { htmlToMarkdown, markdownToHtml } from './rich-text-markdown';

type Tool = 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList';

// Texto con formato simple (negrita, cursiva, listas). Se ve como en un procesador de texto
// y se guarda como texto legible (**negrita**, "- " viñetas), ver rich-text-markdown.ts.
@Component({
  selector: 'app-rich-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextField), multi: true }],
  template: `
    <div class="overflow-hidden rounded-md border border-gr-border bg-gr-surface transition focus-within:border-gr-primary focus-within:ring-2 focus-within:ring-gr-primary/30">
      <div role="toolbar" [attr.aria-label]="'Formato de ' + label()" class="flex items-center gap-0.5 border-b border-gr-border-lite bg-gr-bg px-1.5 py-1">
        @for (t of tools; track t.cmd) {
          @if (t.cmd === 'insertUnorderedList') { <span class="mx-1 h-5 w-px bg-gr-border" aria-hidden="true"></span> }
          <button
            type="button" (mousedown)="$event.preventDefault()" (click)="apply(t.cmd)" [disabled]="disabled()"
            [attr.aria-pressed]="active()[t.cmd]" [attr.aria-label]="t.label" [title]="t.label + (t.keys ? ' (' + t.keys + ')' : '')"
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
            [class]="active()[t.cmd] ? 'bg-gr-primary-dark text-gr-primary-lite' : 'text-gr-sub hover:bg-gr-surface hover:text-gr-text'"
          >
            @switch (t.cmd) {
              @case ('bold') { <span class="font-bold">B</span> }
              @case ('italic') { <span class="font-serif italic">I</span> }
              @case ('insertUnorderedList') {
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></svg>
              }
              @case ('insertOrderedList') {
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10"/><text x="2" y="8.5" font-size="7" font-weight="700" fill="currentColor" stroke="none">1</text><text x="2" y="14.5" font-size="7" font-weight="700" fill="currentColor" stroke="none">2</text><text x="2" y="20.5" font-size="7" font-weight="700" fill="currentColor" stroke="none">3</text></svg>
              }
            }
          </button>
        }
        <span class="ml-auto hidden pr-1.5 text-xs text-gr-muted sm:inline">Selecciona el texto y elige el formato</span>
      </div>
      <div class="relative">
        @if (empty()) {
          <span class="pointer-events-none absolute top-2.5 right-4 left-4 text-gr-muted" aria-hidden="true">{{ placeholder() }}</span>
        }
        <div
          #editor [id]="inputId()" role="textbox" aria-multiline="true" [attr.aria-label]="label()"
          [attr.contenteditable]="disabled() ? 'false' : 'true'"
          (input)="onInput()" (blur)="onTouched()" (paste)="onPaste($event)" (focus)="onFocus()" (keydown)="onKeydown($event)"
          class="max-h-72 min-h-24 overflow-y-auto px-4 py-2.5 leading-relaxed text-gr-text focus:outline-none [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
        ></div>
      </div>
    </div>
  `,
})
export class RichTextField implements ControlValueAccessor, AfterViewInit {
  inputId = input('rich-text');
  label = input('Descripción');
  placeholder = input('');

  @ViewChild('editor', { static: true }) private editorRef!: ElementRef<HTMLDivElement>;

  tools: { cmd: Tool; label: string; keys?: string }[] = [
    { cmd: 'bold', label: 'Negrita', keys: 'Ctrl+B' },
    { cmd: 'italic', label: 'Cursiva', keys: 'Ctrl+I' },
    { cmd: 'insertUnorderedList', label: 'Lista con viñetas' },
    { cmd: 'insertOrderedList', label: 'Lista numerada' },
  ];

  empty = signal(true);
  disabled = signal(false);
  active = signal<Record<Tool, boolean>>({ bold: false, italic: false, insertUnorderedList: false, insertOrderedList: false });

  private value = '';
  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  ngAfterViewInit() {
    this.render();
  }

  writeValue(value: string | null): void {
    const next = value ?? '';
    if (next === this.value && this.editorRef?.nativeElement.innerHTML) return;
    this.value = next;
    this.render();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  // El HTML sale de markdownToHtml, que escapa todo el texto.
  private render() {
    const editor = this.editorRef?.nativeElement;
    if (!editor) return;
    editor.innerHTML = markdownToHtml(this.value);
    this.empty.set(!this.value.trim());
  }

  onFocus() {
    // Enter crea párrafos <p> (no <div>) y la negrita usa <b>, no estilos en línea.
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand('styleWithCSS', false, 'false');
  }

  onInput() {
    const editor = this.editorRef.nativeElement;
    this.value = htmlToMarkdown(editor);
    this.empty.set(!this.value.trim() && !editor.querySelector('li'));
    this.onChange(this.value);
    this.refreshState();
  }

  apply(cmd: Tool) {
    const editor = this.editorRef.nativeElement;
    if (document.activeElement !== editor) editor.focus();
    this.onFocus();
    document.execCommand(cmd);
    this.onInput();
  }

  onKeydown(event: KeyboardEvent) {
    // "- " o "1. " al empezar una línea la convierte en lista, como en los procesadores de texto.
    if (event.key !== ' ') return;
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    if (!selection?.isCollapsed || !node || node.nodeType !== Node.TEXT_NODE) return;
    const before = (node.textContent ?? '').slice(0, selection.anchorOffset);
    // Solo si es el comienzo de la línea (el texto es lo primero del párrafo) y no está ya en una lista.
    const block = node.parentElement;
    if (!block || node !== block.firstChild || block.closest('li')) return;
    if (block !== this.editorRef.nativeElement && !['P', 'DIV'].includes(block.tagName)) return;
    const cmd: Tool | null = before === '-' || before === '•' ? 'insertUnorderedList' : /^1[.)]$/.test(before) ? 'insertOrderedList' : null;
    if (!cmd) return;
    event.preventDefault();
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, selection.anchorOffset);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete');
    this.apply(cmd);
  }

  // Pegar desde Word, WhatsApp o una web: entra como texto; las líneas "- " y "1. " quedan como listas.
  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    if (text.includes('\n')) document.execCommand('insertHTML', false, markdownToHtml(text));
    else document.execCommand('insertText', false, text);
    this.onInput();
  }

  @HostListener('document:selectionchange')
  refreshState() {
    const editor = this.editorRef?.nativeElement;
    const anchor = window.getSelection()?.anchorNode;
    if (!editor || !anchor || !editor.contains(anchor)) return;
    this.active.set({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    });
  }
}
