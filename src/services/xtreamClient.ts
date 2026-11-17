import {
  XtreamAuthResponse,
  IptvCategory,
  LiveChannel,
  VodMovie,
  SeriesItem,
  SeriesInfoResponse,
  EpgProgram,
} from '../types/iptv';
import { parseRawEpgItem } from './epgParser';

export class XtreamClient {
  private serverUrl: string;
  private username: string;
  private password?: string;

  constructor(serverUrl: string, username: string, password?: string) {
    this.serverUrl = this.normalizeUrl(serverUrl);
    this.username = username.trim();
    this.password = password?.trim();
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public setCredentials(serverUrl: string, username: string, password?: string): void {
    this.serverUrl = this.normalizeUrl(serverUrl);
    this.username = username.trim();
    this.password = password?.trim();
  }

  public getStreamUrl(streamId: string | number, type: 'live' | 'movie' | 'series', containerExtension: string = 'mp4'): string {
    const id = Number(streamId);
    if (type === 'live') {
      return this.getLiveStreamUrl(id, 'm3u8');
    }
    if (type === 'movie') {
      return this.getMovieStreamUrl(id, containerExtension);
    }
    return this.getEpisodeStreamUrl(streamId, containerExtension);
  }

  private normalizeUrl(url: string): string {
    let clean = url.trim();

    // Porta 80 é exclusivamente HTTP (não suporta TLS/SSL).
    // O erro "SSLException: Unable to parse TLS packet header" ocorre quando tenta-se https:// na porta 80.
    if (clean.startsWith('https://') && (clean.includes(':80/') || clean.endsWith(':80'))) {
      clean = clean.replace('https://', 'http://');
    }

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    return clean.replace(/\/+$/, '');
  }

  private getBaseApiUrl(): string {
    const encodedUser = encodeURIComponent(this.username);
    const encodedPass = this.password ? encodeURIComponent(this.password) : '';
    return `${this.serverUrl}/player_api.php?username=${encodedUser}&password=${encodedPass}`;
  }

  // Cache em memória de requisições para evitar OOM e re-download de 25MB+ de dados JSON em Smart TVs
  private static apiCache = new Map<string, { data: any; timestamp: number }>();

  public static clearCache(): void {
    XtreamClient.apiCache.clear();
  }

  /**
   * Executa requisições HTTP com User-Agent compatível com IPTV Smarters,
   * timeout controlado, cache em memória e fallback automático de SSL/TLS (https <-> http).
   */
  private async fetchJson<T>(url: string, timeoutMs: number = 20000): Promise<T> {
    const cached = XtreamClient.apiCache.get(url);
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
      return cached.data as T;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'User-Agent': 'IPTVSmartersPro/1.0.0 (Linux; Android; Mobile; Exoplayer)',
      'Accept': '*/*',
      'Cache-Control': 'no-cache',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Acesso negado pelo servidor (403/401). Verifique usuário, senha ou validade da lista.');
        }
        if (response.status === 404) {
          throw new Error('Ponto de API não encontrado (404). Verifique o DNS/URL do servidor.');
        }
        throw new Error(`Servidor retornou erro HTTP ${response.status} (${response.statusText || 'Erro no servidor'})`);
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        return [] as unknown as T;
      }

      try {
        const parsed = JSON.parse(text) as T;
        XtreamClient.apiCache.set(url, { data: parsed, timestamp: Date.now() });
        return parsed;
      } catch (parseErr) {
        if (text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('<head')) {
          throw new Error('O servidor respondeu com uma página web (HTML) em vez de dados JSON. Verifique a URL e porta do provedor.');
        }
        throw new Error(`Dados inválidos recebidos do provedor IPTV: ${text.slice(0, 100)}...`);
      }
    } catch (err: any) {
      clearTimeout(timer);

      // Fallback Inteligente de Protocolo:
      // Se deu erro de SSL/TLS ("Unable to parse TLS packet header" ou SSLException)
      const isSslError =
        err?.message?.includes('SSL') ||
        err?.message?.includes('TLS') ||
        err?.message?.includes('packet header') ||
        err?.message?.includes('handshake');

      if (isSslError && url.startsWith('https://')) {
        const httpUrl = url.replace('https://', 'http://');
        console.warn(`[XtreamClient] Fallback de SSL detectado. Tentando via HTTP: ${httpUrl}`);
        this.serverUrl = this.serverUrl.replace('https://', 'http://');
        return this.fetchJson<T>(httpUrl, timeoutMs);
      }

      if (err.name === 'AbortError') {
        throw new Error('Tempo limite de conexão esgotado (Timeout). O servidor IPTV demorou muito para responder.');
      }
      throw err;
    }
  }

  public async authenticate(): Promise<XtreamAuthResponse> {
    const url = this.getBaseApiUrl();
    const data = await this.fetchJson<any>(url, 15000);

    if (!data || typeof data !== 'object') {
      throw new Error('Resposta de autenticação vazia ou inválida.');
    }

    if (!data.user_info || data.user_info.auth === 0 || data.user_info.status !== 'Active') {
      const msg = data.user_info?.message || 'Usuário ou senha inválidos ou conta inativa/expirada.';
      throw new Error(msg);
    }
    return data as XtreamAuthResponse;
  }

  public async getLiveCategories(): Promise<IptvCategory[]> {
    const url = `${this.getBaseApiUrl()}&action=get_live_categories`;
    const res = await this.fetchJson<any>(url, 12000);
    return Array.isArray(res) ? res : [];
  }

  public async getLiveStreams(categoryId?: string): Promise<LiveChannel[]> {
    let url = `${this.getBaseApiUrl()}&action=get_live_streams`;
    const isAll = !categoryId || categoryId === 'all';
    if (!isAll) {
      url += `&category_id=${encodeURIComponent(categoryId)}`;
    }
    const timeout = isAll ? 45000 : 12000;
    try {
      const res = await this.fetchJson<any>(url, timeout);
      return Array.isArray(res) ? res : [];
    } catch (e) {
      if (isAll) {
        console.warn('Falha graciosa ao carregar canais gerais:', e);
        return [];
      }
      throw e;
    }
  }

  public async getVodCategories(): Promise<IptvCategory[]> {
    const url = `${this.getBaseApiUrl()}&action=get_vod_categories`;
    const res = await this.fetchJson<any>(url, 12000);
    return Array.isArray(res) ? res : [];
  }

  public async getVodStreams(categoryId?: string): Promise<VodMovie[]> {
    let url = `${this.getBaseApiUrl()}&action=get_vod_streams`;
    const isAll = !categoryId || categoryId === 'all';
    if (!isAll) {
      url += `&category_id=${encodeURIComponent(categoryId)}`;
    }
    const timeout = isAll ? 45000 : 12000;
    try {
      const res = await this.fetchJson<any>(url, timeout);
      return Array.isArray(res) ? res : [];
    } catch (e) {
      if (isAll) {
        console.warn('Falha graciosa ao carregar catálogo completo de VOD:', e);
        return [];
      }
      throw e;
    }
  }

  public async getVodInfo(vodId: number): Promise<any> {
    const url = `${this.getBaseApiUrl()}&action=get_vod_info&vod_id=${vodId}`;
    return this.fetchJson<any>(url, 12000);
  }

  public async getSeriesCategories(): Promise<IptvCategory[]> {
    const url = `${this.getBaseApiUrl()}&action=get_series_categories`;
    const res = await this.fetchJson<any>(url, 12000);
    return Array.isArray(res) ? res : [];
  }

  public async getSeries(categoryId?: string): Promise<SeriesItem[]> {
    let url = `${this.getBaseApiUrl()}&action=get_series`;
    const isAll = !categoryId || categoryId === 'all';
    if (!isAll) {
      url += `&category_id=${encodeURIComponent(categoryId)}`;
      const res = await this.fetchJson<any>(url, 12000);
      return Array.isArray(res) ? res : [];
    }

    // Consulta geral com 45 segundos e fallback automático para a primeira categoria
    try {
      const res = await this.fetchJson<any>(url, 45000);
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch (e) {
      console.warn('Consulta geral de séries falhou ou expirou. Acionando fallback...', e);
    }

    // Fallback Automático para Séries: se getSeries() sem parâmetro falhar ou retornar vazio
    try {
      const cats = await this.getSeriesCategories();
      if (cats && cats.length > 0) {
        const firstCatId = cats[0].category_id;
        const fallbackUrl = `${this.getBaseApiUrl()}&action=get_series&category_id=${encodeURIComponent(firstCatId)}`;
        const fallbackRes = await this.fetchJson<any>(fallbackUrl, 12000);
        return Array.isArray(fallbackRes) ? fallbackRes : [];
      }
    } catch (fallbackErr) {
      console.warn('Erro no fallback da primeira categoria de séries:', fallbackErr);
    }

    return [];
  }

  public async getSeriesInfo(seriesId: number): Promise<SeriesInfoResponse> {
    const url = `${this.getBaseApiUrl()}&action=get_series_info&series_id=${seriesId}`;
    return this.fetchJson<SeriesInfoResponse>(url, 12000);
  }

  public async getShortEpg(streamId: number): Promise<EpgProgram[]> {
    try {
      const url = `${this.getBaseApiUrl()}&action=get_short_epg&stream_id=${streamId}&limit=10`;
      const data = await this.fetchJson<any>(url, 8000);
      const listings = data?.epg_listings || [];
      return listings.map((item: any) => parseRawEpgItem(item));
    } catch (e) {
      console.warn('Error fetching EPG:', e);
      return [];
    }
  }

  // Stream URL Generators
  public getLiveStreamUrl(streamId: number, extension: 'ts' | 'm3u8' = 'm3u8'): string {
    return `${this.serverUrl}/live/${encodeURIComponent(this.username)}/${encodeURIComponent(this.password || '')}/${streamId}.${extension}`;
  }

  public getMovieStreamUrl(streamId: number, containerExtension: string = 'mp4'): string {
    const ext = containerExtension.replace(/^\./, '');
    return `${this.serverUrl}/movie/${encodeURIComponent(this.username)}/${encodeURIComponent(this.password || '')}/${streamId}.${ext}`;
  }

  public getEpisodeStreamUrl(episodeId: string | number, containerExtension: string = 'mp4'): string {
    const ext = containerExtension.replace(/^\./, '');
    return `${this.serverUrl}/series/${encodeURIComponent(this.username)}/${encodeURIComponent(this.password || '')}/${episodeId}.${ext}`;
  }
}

export const xtreamClient = new XtreamClient('', '', '');
