// Formato simple que se guarda como texto legible (también se lee bien en WhatsApp o en un Excel):
//   **negrita**   *cursiva*   "- " lista con viñetas   "1. " lista numerada
// La tienda online lo dibuja con el mismo criterio.

const BULLET = /^\s*[-•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([^*]+?)(?<=\S)\*(?!\*)/g, '$1<em>$2</em>');
}

// Texto guardado → HTML para el editor. Todo el texto pasa por escapeHtml: no entra HTML del usuario.
export function markdownToHtml(markdown: string | null | undefined): string {
  if (!markdown?.trim()) return '';
  let html = '';
  let list: 'ul' | 'ol' | null = null;
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const kind = bullet ? 'ul' : numbered ? 'ol' : null;
    if (list && kind !== list) {
      html += `</${list}>`;
      list = null;
    }
    if (kind) {
      if (!list) html += `<${kind}>`;
      list = kind;
      html += `<li>${inlineToHtml((bullet ?? numbered)![1])}</li>`;
    } else {
      html += line.trim() ? `<p>${inlineToHtml(line)}</p>` : '<p><br></p>';
    }
  }
  if (list) html += `</${list}>`;
  return html;
}

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE']);

// Marca cada línea por separado y deja los espacios afuera: "** hola**" no sería negrita.
function wrap(text: string, mark: string): string {
  return text
    .split('\n')
    .map(part => {
      const core = part.trim();
      if (!core) return part;
      const lead = part.slice(0, part.indexOf(core));
      const trail = part.slice(lead.length + core.length);
      return `${lead}${mark}${core}${mark}${trail}`;
    })
    .join('\n');
}

function inlineText(node: Node, bold = false, italic = false): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/ /g, ' ').replace(/\n/g, ' ');
  if (!(node instanceof HTMLElement)) return '';
  if (node.tagName === 'BR') return '\n';
  const weight = node.style.fontWeight;
  const isBold = bold || node.tagName === 'B' || node.tagName === 'STRONG' || weight === 'bold' || Number(weight) >= 600;
  const isItalic = italic || node.tagName === 'I' || node.tagName === 'EM' || node.style.fontStyle === 'italic';
  let inner = Array.from(node.childNodes).map(child => inlineText(child, isBold, isItalic)).join('');
  if (isBold && !bold) inner = wrap(inner, '**');
  if (isItalic && !italic) inner = wrap(inner, '*');
  return inner;
}

function collectBlocks(container: Element, lines: string[]) {
  let buffer = '';
  const flush = () => {
    if (buffer) lines.push(...buffer.replace(/\n$/, '').split('\n'));
    buffer = '';
  };
  for (const child of Array.from(container.childNodes)) {
    const tag = child instanceof HTMLElement ? child.tagName : '';
    if (tag === 'UL' || tag === 'OL') {
      flush();
      let index = 1;
      for (const item of Array.from((child as HTMLElement).children)) {
        const text = inlineText(item).replace(/\s*\n\s*/g, ' ').trim();
        if (text) lines.push(tag === 'UL' ? `- ${text}` : `${index++}. ${text}`);
      }
    } else if (BLOCK_TAGS.has(tag)) {
      flush();
      const hasBlocks = Array.from((child as HTMLElement).children).some(c => BLOCK_TAGS.has(c.tagName) || c.tagName === 'UL' || c.tagName === 'OL');
      if (hasBlocks) collectBlocks(child as HTMLElement, lines);
      else lines.push(...inlineText(child).replace(/\n$/, '').split('\n'));
    } else {
      buffer += inlineText(child);
    }
  }
  flush();
}

// Contenido del editor → texto guardado. Sin más de una línea vacía seguida ni líneas vacías en los bordes.
export function htmlToMarkdown(root: HTMLElement): string {
  const lines: string[] = [];
  collectBlocks(root, lines);
  const clean: string[] = [];
  for (const line of lines.map(l => l.replace(/\s+$/, ''))) {
    if (!line && (!clean.length || !clean[clean.length - 1])) continue;
    clean.push(line);
  }
  while (clean.length && !clean[clean.length - 1]) clean.pop();
  return clean.join('\n');
}
