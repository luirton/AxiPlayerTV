import { xtreamClient } from './xtreamClient';
import { VodStream, Category } from '../types/iptv';

export interface AlternativeMovieVersion {
  stream_id: number;
  name: string;
  category_name: string;
  category_id: string;
  container_extension: string;
  stream_icon?: string;
  added?: string;
  isCurrent?: boolean;
}

/**
 * Normaliza o título para comparação de versões (remove tags como 4K, 2026, Dublado, etc.)
 */
export function normalizeTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/\b(4k|uhd|fhd|hd|sd|dual|dublado|legendado|leg|dub|nacional|pedido|pedidos|lancamento|lancamentos)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Busca versões alternativas de um mesmo filme em outras categorias da lista IPTV
 */
export async function findAlternativeMovieVersions(
  title: string,
  currentStreamId: number,
  currentCategoryId?: string
): Promise<AlternativeMovieVersion[]> {
  const normTitle = normalizeTitle(title);
  if (!normTitle || normTitle.length < 2) return [];

  const results: AlternativeMovieVersion[] = [];

  try {
    const categories: Category[] = await xtreamClient.getVodCategories().catch(() => []);
    if (!categories || categories.length === 0) return [];

    // Priorizar categorias comuns de filmes (Lançamentos, 4K, Pedidos, etc.)
    const checkCats = categories
      .filter((c) => c.category_id !== 'favorites' && c.category_id !== currentCategoryId)
      .slice(0, 8);

    for (const cat of checkCats) {
      try {
        const movies: VodStream[] = await xtreamClient.getVodStreams(cat.category_id);
        const match = movies.find(
          (m) => m.stream_id !== currentStreamId && normalizeTitle(m.name) === normTitle
        );
        if (match) {
          results.push({
            stream_id: match.stream_id,
            name: match.name,
            category_name: cat.category_name,
            category_id: match.category_id,
            container_extension: match.container_extension || 'mp4',
            stream_icon: match.stream_icon,
            added: match.added,
            isCurrent: false,
          });
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Erro ao buscar versões alternativas:', err);
  }

  return results;
}
