import { EpgProgram } from '../types/iptv';

const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

/**
 * Decodifica Base64 com suporte total a UTF-8 (acentos, cedilha, emojis).
 * Se a string não for Base64 (ou for texto legível normal), retorna a string original.
 */
export function decodeBase64Text(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const str = input.trim();

  // Se tem menos de 4 caracteres, contém espaços, quebras de linha ou caracteres fora do padrão base64
  if (str.length < 4 || /\s/.test(str) || /[^A-Za-z0-9+/=]/.test(str)) {
    return str;
  }

  // Verifica se o comprimento é múltiplo de 4
  if (str.length % 4 !== 0) {
    return str;
  }

  try {
    const cleanStr = str.replace(/[^A-Za-z0-9+/=]/g, '');
    const bytes: number[] = [];
    let i = 0;

    while (i < cleanStr.length) {
      const enc1 = b64chars.indexOf(cleanStr.charAt(i++));
      const enc2 = b64chars.indexOf(cleanStr.charAt(i++));
      const enc3 = b64chars.indexOf(cleanStr.charAt(i++));
      const enc4 = b64chars.indexOf(cleanStr.charAt(i++));

      if (enc1 === -1 || enc2 === -1) break;

      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;

      bytes.push(chr1);
      if (enc3 !== 64 && enc3 !== -1) {
        bytes.push(chr2);
      }
      if (enc4 !== 64 && enc4 !== -1) {
        bytes.push(chr3);
      }
    }

    // Decodifica bytes em UTF-8
    let decoded = '';
    if (typeof TextDecoder !== 'undefined') {
      try {
        decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
      } catch (e) {
        decoded = '';
      }
    }

    // Fallback manual UTF-8 decoder se TextDecoder falhar
    if (!decoded) {
      let idx = 0;
      while (idx < bytes.length) {
        const b1 = bytes[idx++];
        if (b1 < 0x80) {
          decoded += String.fromCharCode(b1);
        } else if (b1 >= 0xc0 && b1 < 0xe0 && idx < bytes.length) {
          const b2 = bytes[idx++];
          decoded += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
        } else if (b1 >= 0xe0 && b1 < 0xf0 && idx + 1 < bytes.length) {
          const b2 = bytes[idx++];
          const b3 = bytes[idx++];
          decoded += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
        }
      }
    }

    // Se o texto decodificado for legível (contém letras ou números comuns), usamos ele!
    // Se for lixo binário, mantemos o original
    if (decoded && /[a-zA-Z0-9\u00C0-\u00FF]/.test(decoded)) {
      return decoded.trim();
    }

    return str;
  } catch (err) {
    return str;
  }
}

/**
 * Formata data/hora para exibição amigável (ex: "19:30" ou "20:45")
 */
export function formatEpgTime(dateStr?: string, timestamp?: number | string): string {
  if (dateStr && typeof dateStr === 'string') {
    // Tenta extrair HH:mm de "YYYY-MM-DD HH:mm:ss" ou "YYYY-MM-DD HH:mm"
    const timeMatch = dateStr.match(/(\d{2}:\d{2})(:\d{2})?/);
    if (timeMatch && timeMatch[1]) {
      return timeMatch[1];
    }
  }

  if (timestamp) {
    try {
      const num = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
      if (!isNaN(num) && num > 0) {
        // Se timestamp estiver em segundos (comum no Xtream Codes), multiplica por 1000
        const date = new Date(num > 1e11 ? num : num * 1000);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    } catch (e) {}
  }

  return dateStr || '';
}

/**
 * Processa e higieniza um item bruto de EPG retornado pela API do Xtream Codes
 */
export function parseRawEpgItem(item: any): EpgProgram {
  const rawTitle = item.title || item.name || '';
  const rawDesc = item.description || item.descr || '';

  const cleanTitle = decodeBase64Text(rawTitle);
  const cleanDesc = decodeBase64Text(rawDesc);

  const startTime = formatEpgTime(item.start, item.start_timestamp);
  const endTime = formatEpgTime(item.end || item.stop, item.stop_timestamp);

  return {
    id: String(item.id || item.epg_id || Math.random()),
    epg_id: String(item.epg_id || ''),
    title: cleanTitle || 'Programação Ao Vivo',
    lang: String(item.lang || 'pt'),
    start: startTime || '00:00',
    end: endTime || '00:00',
    description: cleanDesc,
    channel_id: String(item.channel_id || ''),
    start_timestamp: Number(item.start_timestamp || 0),
    stop_timestamp: Number(item.stop_timestamp || 0),
  };
}
