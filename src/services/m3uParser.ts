import { IptvCategory, LiveChannel, VodMovie } from '../types/iptv';

export interface ParsedM3uResult {
  categories: IptvCategory[];
  channels: LiveChannel[];
  movies: VodMovie[];
}

/**
 * Baixa e analisa listas M3U/M3U8 de links diretos com suporte a User-Agent IPTV Smarters.
 */
export async function fetchAndParseM3u(url: string, timeoutMs: number = 30000): Promise<ParsedM3uResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'IPTVSmartersPro/1.0.0 (Linux; Android; Mobile)',
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Falha ao baixar lista M3U (HTTP ${response.status})`);
    }

    const text = await response.text();
    return parseM3uString(text);
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Tempo esgotado ao baixar a lista M3U. O servidor da lista demorou para responder.');
    }
    throw err;
  }
}

/**
 * Faz o parse de uma string no formato M3U/M3U8.
 */
export function parseM3uString(content: string): ParsedM3uResult {
  const lines = content.split(/\r?\n/);
  const categoriesMap = new Map<string, IptvCategory>();
  const channels: LiveChannel[] = [];
  const movies: VodMovie[] = [];

  let currentCategory = 'Geral';
  let currentName = '';
  let currentLogo = '';
  let currentEpgId = '';
  let streamCounter = 1000;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      // Extrai group-title (categoria)
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      currentCategory = (groupMatch && groupMatch[1].trim()) ? groupMatch[1].trim() : 'Geral';

      // Extrai tvg-logo
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      currentLogo = logoMatch ? logoMatch[1].trim() : '';

      // Extrai tvg-id
      const epgMatch = line.match(/tvg-id="([^"]*)"/i);
      currentEpgId = epgMatch ? epgMatch[1].trim() : '';

      // Extrai o nome após a última vírgula da linha #EXTINF
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentName = line.substring(commaIndex + 1).trim();
      } else {
        currentName = `Canal ${streamCounter}`;
      }

      // Adiciona categoria se não existir
      if (!categoriesMap.has(currentCategory)) {
        categoriesMap.set(currentCategory, {
          category_id: String(categoriesMap.size + 1),
          category_name: currentCategory,
          parent_id: 0,
        });
      }
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      const catObj = categoriesMap.get(currentCategory) || {
        category_id: '1',
        category_name: currentCategory,
        parent_id: 0,
      };

      const streamId = streamCounter++;
      const isMovie = /\.(mp4|mkv|avi)$/i.test(line) || /filme|movie|vod/i.test(currentCategory);

      if (isMovie) {
        movies.push({
          num: streamId,
          name: currentName,
          stream_type: 'movie',
          stream_id: streamId,
          stream_icon: currentLogo,
          rating: '0',
          rating_5based: 0,
          added: String(Date.now()),
          category_id: catObj.category_id,
          container_extension: 'mp4',
          custom_sid: '',
          direct_source: line,
        });
      } else {
        channels.push({
          num: streamId,
          name: currentName,
          stream_type: 'live',
          stream_id: streamId,
          stream_icon: currentLogo,
          epg_channel_id: currentEpgId,
          added: String(Date.now()),
          category_id: catObj.category_id,
          custom_sid: '',
          tv_archive: 0,
          direct_source: line,
        });
      }

      // Reseta temporários
      currentName = '';
      currentLogo = '';
      currentEpgId = '';
    }
  }

  return {
    categories: Array.from(categoriesMap.values()),
    channels,
    movies,
  };
}
