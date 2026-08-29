const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()_-+=?';
const ALL = LOWERCASE + UPPERCASE + DIGITS + SPECIAL;

function randomChar(pool: string): string {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return pool[value[0] % pool.length];
}

// Garantiza al menos un carácter de cada tipo (minúscula, mayúscula, número,
// especial); el resto se completa al azar y se mezcla para que las posiciones
// garantizadas no queden siempre en el mismo lugar.
export function generatePassword(length = 8): string {
  const chars = [randomChar(LOWERCASE), randomChar(UPPERCASE), randomChar(DIGITS), randomChar(SPECIAL)];

  for (let i = chars.length; i < length; i++) {
    chars.push(randomChar(ALL));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
