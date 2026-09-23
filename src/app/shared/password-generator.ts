const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()_-+=?';
const ALL = LOWERCASE + UPPERCASE + DIGITS + SPECIAL;

function randomInt(maxExclusive: number): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % maxExclusive;
}

function randomChar(pool: string): string {
  return pool[randomInt(pool.length)];
}

// Garantiza al menos un carácter de cada tipo (minúscula, mayúscula, número,
// especial); el resto se completa al azar y se mezcla para que las posiciones
// garantizadas no queden siempre en el mismo lugar. length=16 por defecto
// (12+ recomendado para contraseñas generadas — NIST/OWASP).
export function generatePassword(length = 16): string {
  const chars = [randomChar(LOWERCASE), randomChar(UPPERCASE), randomChar(DIGITS), randomChar(SPECIAL)];

  for (let i = chars.length; i < length; i++) {
    chars.push(randomChar(ALL));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
