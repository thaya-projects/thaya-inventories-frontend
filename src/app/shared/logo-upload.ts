// Reglas reales del backend para POST .../logo.
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function logoFileError(file: File): string | null {
  if (!LOGO_ACCEPTED_TYPES.includes(file.type)) {
    return `El tipo de archivo '${file.type}' no está permitido.`;
  }
  if (file.size > LOGO_MAX_BYTES) {
    return 'El archivo no puede superar los 5MB.';
  }
  return null;
}
