/**
 * Utilitário para limpar e normalizar nomes de categorias IPTV
 * Remove prefixos redundantes como "Filmes | ", "Séries | ", "Filmes - ", etc.
 * Exemplos:
 * "Filmes | pedidos" -> "Pedidos"
 * "Séries | Dorama" -> "Dorama"
 * "FILMES | LANÇAMENTOS 2024" -> "Lançamentos 2024"
 */
export const cleanCategoryName = (rawName: string, type: 'movie' | 'series' = 'movie'): string => {
  if (!rawName) return '';
  let clean = rawName.trim();

  // 1. Remove prefixos compostos como "Filmes |", "Filmes -", "Séries |", "Series -", etc.
  clean = clean.replace(/^(filmes?|movies?|séries?|series?|vod)\s*(\||-|_|:|>|•|–|—)\s*/i, '');

  // 2. Remove tags em colchetes ou parênteses no início, como "[Filmes]", "(Séries)"
  clean = clean.replace(/^\[(filmes?|séries?|series?|vod)\]\s*/i, '');
  clean = clean.replace(/^\((filmes?|séries?|series?|vod)\)\s*/i, '');

  // 3. Remove palavras repetidas no início caso tenha sobrado "Filmes Pedidos"
  clean = clean.replace(/^(filmes?|movies?|séries?|series?|vod)\s+/i, '');

  // 4. Limpa caracteres residuais de pontuação no início ou fim
  clean = clean.replace(/^[\s\|\-_:>•–—]+|[\s\|\-_:>•–—]+$/g, '').trim();

  if (!clean) {
    return type === 'movie' ? 'Geral' : 'Geral';
  }

  // Se a string estiver toda em caixa alta (ex: "PEDIDOS" ou "DORAMA"), formata para Title Case
  if (clean === clean.toUpperCase() && clean.length > 2) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  } else {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  return clean;
};

export const BRAND_COLORS = [
  '#E50914', // Vermelho (Netflix / Destaque)
  '#00A8E1', // Ciano Neon (Prime Video)
  '#3B82F6', // Azul Royal (Disney+)
  '#6366F1', // Indigo / Roxo (Max)
  '#EC4899', // Pink / Magenta (Globoplay)
  '#10B981', // Verde Esmeralda
  '#F59E0B', // Âmbar / Ouro
  '#06B6D4', // Azul Céu
  '#8B5CF6', // Violeta
  '#E11D48', // Carmim / Rose
];
