import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EnrichedMetadata {
  imdbId?: string | null;
  poster: string | null;
  plot: string | null;
  year: string | null;
  genre: string | null;
  rating: string | null;
  backdrop: string | null;
}

// Cache em memória para acesso instantâneo durante a sessão da TV
const memoryCache = new Map<string, EnrichedMetadata | null>();

/**
 * Normaliza uma string para comparação (sem acentos, minúscula, caracteres alfanuméricos).
 */
export function normalizeText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Valida se o título candidato condiz com a busca, prevenindo pôsteres errados.
 */
export function isTitleMatch(query: string, candidate: string): boolean {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return false;

  // 1. Correspondência exata ou inclusão direta
  if (q === c || c.includes(q) || q.includes(c)) return true;

  // 2. Correspondência por palavras-chave principais
  const stopWords = new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos',
    'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'e',
    'the', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'and'
  ]);

  const qWords = q.split(' ').filter((w) => w.length > 1 && !stopWords.has(w));
  const cWords = new Set(c.split(' ').filter((w) => w.length > 1 && !stopWords.has(w)));

  if (qWords.length === 0) return false;

  let matches = 0;
  for (const w of qWords) {
    if (cWords.has(w)) matches++;
  }

  return (matches / qWords.length) >= 0.5;
}

/**
 * Normaliza e limpa o título do filme ou série removendo tags de resolução,
 * qualidade, dublagem e sufixos comuns em listas IPTV.
 * Ex: "O Anel Amaldiçoado [L]" -> "O Anel Amaldiçoado"
 */
export function cleanMediaTitle(rawTitle: string): { cleanTitle: string; year?: string } {
  if (!rawTitle) return { cleanTitle: '' };

  let title = rawTitle.trim();

  // 1. Remove prefixos comuns de IPTV como "|BR|", "4K -", "FHD |", "SERIES |", "FILMES -"
  title = title.replace(/^(?:\[.*?\]|\(.*?\)|[A-Z0-9\s\-_|#]+[:|\-])\s*/i, '');

  // 2. Extrai ano no formato (19xx ou 20xx)
  let year: string | undefined;
  const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // 3. Remove termos de qualidade, idioma, legendas e tags entre colchetes
  title = title
    .replace(/\b(4k|fhd|hd|sd|uhd|hevc|h265|x265|1080p|720p|480p)\b/gi, '')
    .replace(/\b(dublado|legendado|dub|leg|nacional|dual\s*audio|multi)\b/gi, '')
    .replace(/\[.*?\]|\(.*?\)/g, '') // remove qualquer conteúdo entre colchetes ou parênteses (ex: [L], [DUB])
    .replace(/\b(s\d+\s*e\d+|\d+ª\s*temp.*|temporada\s*\d+)\b/gi, '') // remove temporada/episódio
    .replace(/[-_–—|#]+/g, ' ') // substitui traços e pipes por espaço
    .replace(/\s+/g, ' ') // normaliza espaços múltiplos
    .trim();

  return { cleanTitle: title, year };
}

/**
 * Consulta a API pública de sugestões do IMDb (v3.sg.media-imdb.com).
 * O IMDb é o melhor índice mundial pois mapeia todos os títulos alternativos (AKA) em português
 * para o registro oficial correspondente (ex: "O Anel Amaldiçoado" -> tt22206842).
 */
async function searchImdb(cleanTitle: string): Promise<{
  imdbId: string;
  title: string;
  year: string | null;
  poster: string | null;
  cast: string | null;
} | null> {
  const norm = normalizeText(cleanTitle);
  if (!norm) return null;

  const searchTerms = [norm];
  const withoutArticle = norm.replace(/^(?:o|a|os|as|um|uma|the)\s+/i, '');
  if (withoutArticle !== norm) {
    searchTerms.push(withoutArticle);
  }

  for (const term of searchTerms) {
    try {
      const slug = encodeURIComponent(term);
      const url = `https://v3.sg.media-imdb.com/suggestion/x/${slug}.json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.d) ? data.d : [];
        const match = items.find((x: any) => x.id && x.id.startsWith('tt') && x.i?.imageUrl);
        if (match) {
          return {
            imdbId: match.id,
            title: match.l || cleanTitle,
            year: match.y ? String(match.y) : null,
            poster: match.i?.imageUrl || null,
            cast: match.s || null,
          };
        }
      }
    } catch (e) {
      // Ignora erro de requisição individual
    }
  }

  return null;
}

/**
 * Busca poster e dados de metadados priorizando IMDb e iTunes Brasil,
 * com validação estrita de correspondência de título para nunca exibir capa incorreta.
 */
export async function enrichMediaMetadata(
  rawTitle: string,
  type: 'movie' | 'series' = 'movie'
): Promise<EnrichedMetadata | null> {
  const { cleanTitle, year } = cleanMediaTitle(rawTitle);
  if (!cleanTitle || cleanTitle.length < 2) return null;

  const cacheKey = `@axi_enrich_v4_${type}_${cleanTitle.toLowerCase()}`;

  // 1. Verificação no Cache em memória (instantâneo na TV)
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || null;
  }

  // 2. Verificação no AsyncStorage
  try {
    const cachedJson = await AsyncStorage.getItem(cacheKey);
    if (cachedJson) {
      const parsed: EnrichedMetadata = JSON.parse(cachedJson);
      memoryCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch (e) {
    // Ignora erro de leitura de storage
  }

  let enriched: EnrichedMetadata | null = null;

  try {
    // ETAPA 1: Busca no IMDb (índice global com suporte a títulos em português)
    const imdbResult = await searchImdb(cleanTitle);
    if (imdbResult && imdbResult.poster) {
      enriched = {
        imdbId: imdbResult.imdbId,
        poster: imdbResult.poster,
        plot: null,
        year: imdbResult.year || year || null,
        genre: null,
        rating: null,
        backdrop: imdbResult.poster,
      };

      // Se temos o IMDb ID (tt...), busca sinopse e detalhes via Cinemeta Meta por ID
      if (imdbResult.imdbId) {
        try {
          const cinemetaType = type === 'series' ? 'series' : 'movie';
          const metaUrl = `https://v3-cinemeta.strem.io/meta/${cinemetaType}/${imdbResult.imdbId}.json`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const metaRes = await fetch(metaUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (metaRes.ok) {
            const metaData = await metaRes.json();
            const meta = metaData?.meta;
            if (meta) {
              enriched.plot = meta.description || null;
              enriched.genre = Array.isArray(meta.genres) ? meta.genres.join(', ') : null;
              enriched.rating = meta.imdbRating || null;
              enriched.backdrop = meta.background || enriched.poster;
            }
          }
        } catch (e) {}
      }
    }

    // ETAPA 2: Se não localizou no IMDb ou deseja capa com tipografia brasileira, busca no iTunes Brasil
    if (!enriched || !enriched.poster || !enriched.plot) {
      try {
        const itunesBrUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&country=BR&limit=5`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(itunesBrUrl, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data?.results) ? data.results : [];
          for (const item of items) {
            if (item.trackName && isTitleMatch(cleanTitle, item.trackName)) {
              let posterUrl = item.artworkUrl100 || null;
              if (posterUrl) {
                posterUrl = posterUrl.replace(/100x100bb\.jpg/g, '600x600bb.jpg');
              }
              enriched = {
                imdbId: enriched?.imdbId || null,
                poster: posterUrl || enriched?.poster || null,
                plot: item.longDescription || item.shortDescription || enriched?.plot || null,
                year: item.releaseDate ? item.releaseDate.slice(0, 4) : enriched?.year || year || null,
                genre: item.primaryGenreName || enriched?.genre || null,
                rating: enriched?.rating || null,
                backdrop: posterUrl || enriched?.backdrop || null,
              };
              break;
            }
          }
        }
      } catch (e) {}
    }

    // ETAPA 3: Fallback para séries no TVMaze
    if ((!enriched || !enriched.poster) && type === 'series') {
      try {
        const tvMazeUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(tvMazeUrl, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const show = await res.json();
          if (show && show.name && isTitleMatch(cleanTitle, show.name)) {
            const posterUrl = show.image?.original || show.image?.medium || null;
            const cleanSummary = show.summary ? show.summary.replace(/<[^>]*>?/gm, '').trim() : null;

            enriched = {
              imdbId: enriched?.imdbId || null,
              poster: posterUrl || enriched?.poster || null,
              plot: cleanSummary || enriched?.plot || null,
              year: show.premiered ? show.premiered.slice(0, 4) : enriched?.year || year || null,
              genre: Array.isArray(show.genres) ? show.genres.join(', ') : enriched?.genre || null,
              rating: show.rating?.average ? String(show.rating.average) : enriched?.rating || null,
              backdrop: posterUrl || enriched?.backdrop || null,
            };
          }
        }
      } catch (e) {}
    }
  } catch (err) {
    // Falha silenciosa de rede sem travar a interface da TV
  }

  // Grava no cache em memória e persistente
  memoryCache.set(cacheKey, enriched);
  if (enriched) {
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(enriched));
    } catch (e) {}
  }

  return enriched;
}

/**
 * Retorna o pôster enriquecido se a imagem original da lista IPTV estiver ausente ou quebrada.
 */
export async function getEnrichedPoster(
  rawTitle: string,
  type: 'movie' | 'series',
  existingPoster?: string | null
): Promise<string | null> {
  if (existingPoster && existingPoster.trim().length > 10) {
    return existingPoster;
  }
  const meta = await enrichMediaMetadata(rawTitle, type);
  return meta?.poster || null;
}
