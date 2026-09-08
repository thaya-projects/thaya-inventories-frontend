const STOPWORDS = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'PARA', 'Y', 'EN', 'CON', 'AL', 'A']);

function significantWords(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (incluida la Ñ, que queda como N)
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean)
    .filter(word => !STOPWORDS.has(word));
}

// Sugerencia de código a partir del nombre: las primeras dos palabras
// significativas aportan 2 letras cada una en un solo segmento (ej. "Hojuela
// de Maiz" -> HOMA), y cada palabra significativa siguiente aporta 3 letras
// en su propio segmento separado por guion (ej. "... Amarillo Precocido" ->
// AMA-PRE). Es solo un punto de partida editable, no garantiza unicidad.
export function generateProductCode(name: string): string {
  const words = significantWords(name);
  if (words.length === 0) return '';

  const segments: string[] =
    words.length === 1 ? [words[0].slice(0, 4)] : [words[0].slice(0, 2) + words[1].slice(0, 2)];

  for (const word of words.slice(2)) {
    segments.push(word.slice(0, 3));
  }

  return segments.join('-');
}
