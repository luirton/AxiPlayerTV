/**
 * Utilitário de Controle Parental para detecção de categorias e canais adultos / XXX.
 */
export function isAdultCategory(categoryName?: string): boolean {
  if (!categoryName) return false;
  const normalized = categoryName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const adultRegex = /\b(xxx|adulto|adultos|adult|erotico|erotica|eroticos|eroticas|porno|porn|playboy|sexy|venus|for\s*adult|\+18|18\+|prive|sex)\b/i;

  return (
    adultRegex.test(normalized) ||
    normalized.includes('xxx') ||
    normalized.includes('+18') ||
    normalized.includes('18+') ||
    normalized.includes('adult')
  );
}
