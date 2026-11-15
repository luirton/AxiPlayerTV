import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedAccount, LiveChannel, VodMovie, SeriesItem } from '../types/iptv';

const KEYS = {
  ACCOUNTS: '@axi_accounts',
  ACTIVE_ACCOUNT: '@axi_active_account',
  FAVORITES: '@axi_favorites',
  FAVORITE_CHANNELS_DATA: '@axi_fav_channels_data',
  FAVORITES_MOVIES: '@axi_favorites_movies',
  FAVORITE_MOVIES_DATA: '@axi_fav_movies_data',
  FAVORITES_SERIES: '@axi_favorites_series',
  FAVORITE_SERIES_DATA: '@axi_fav_series_data',
  WATCH_PROGRESS: '@axi_watch_progress',
  MY_LIST: '@axi_my_list',
  WATCH_LATER: '@axi_watch_later',
  PARENTAL_PIN: '@axi_parental_pin',
  SETTINGS: '@axi_settings',
};

export interface MediaListItem {
  id: number | string;
  title: string;
  poster?: string;
  backdrop?: string;
  type: 'movie' | 'series';
  category_id?: string;
  category_name?: string;
  rating?: string;
  year?: string;
  genre?: string;
  plot?: string;
  extension?: string;
  addedAt: number;
  rawItem?: any;
}

export interface WatchProgressItem {
  id: number | string;
  title: string;
  poster?: string;
  type: 'movie' | 'series' | 'live';
  positionSec: number;
  durationSec: number;
  extension?: string;
  timestamp: number;
  extra?: any;
}

export interface AppSettings {
  streamFormat: 'm3u8' | 'ts';
  playerEngine: 'exoplayer' | 'vlc';
  autoPlayNextEpisode: boolean;
  bufferSizeMs: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  streamFormat: 'm3u8',
  playerEngine: 'exoplayer',
  autoPlayNextEpisode: true,
  bufferSizeMs: 5000,
};

function fixAccountProtocol(account: SavedAccount): SavedAccount {
  if (account.serverUrl.startsWith('https://') && (account.serverUrl.includes(':80/') || account.serverUrl.endsWith(':80'))) {
    const correctedUrl = account.serverUrl.replace('https://', 'http://');
    return {
      ...account,
      serverUrl: correctedUrl,
      id: `${account.username}@${correctedUrl}`,
    };
  }
  return account;
}

export const storage = {
  // Accounts
  async getAccounts(): Promise<SavedAccount[]> {
    const json = await AsyncStorage.getItem(KEYS.ACCOUNTS);
    if (!json) return [];
    try {
      const list: SavedAccount[] = JSON.parse(json);
      return list.map(fixAccountProtocol);
    } catch {
      return [];
    }
  },

  async saveAccounts(accounts: SavedAccount[]): Promise<void> {
    const sanitized = accounts.map(fixAccountProtocol);
    await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(sanitized));
  },

  async saveAccount(account: SavedAccount): Promise<void> {
    const fixed = fixAccountProtocol(account);
    const list = await this.getAccounts();
    const index = list.findIndex((a) => a.id === fixed.id);
    if (index >= 0) {
      list[index] = fixed;
    } else {
      list.push(fixed);
    }
    await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(list));
  },

  async removeAccount(accountId: string): Promise<void> {
    const list = await this.getAccounts();
    const filtered = list.filter((a) => a.id !== accountId);
    await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(filtered));
  },

  async getActiveAccount(): Promise<SavedAccount | null> {
    const json = await AsyncStorage.getItem(KEYS.ACTIVE_ACCOUNT);
    if (!json) return null;
    try {
      const account: SavedAccount = JSON.parse(json);
      const fixed = fixAccountProtocol(account);
      if (fixed.serverUrl !== account.serverUrl) {
        await AsyncStorage.setItem(KEYS.ACTIVE_ACCOUNT, JSON.stringify(fixed));
      }
      return fixed;
    } catch {
      return null;
    }
  },

  async setActiveAccount(account: SavedAccount | null): Promise<void> {
    if (!account) {
      await AsyncStorage.removeItem(KEYS.ACTIVE_ACCOUNT);
    } else {
      const fixed = fixAccountProtocol(account);
      await AsyncStorage.setItem(KEYS.ACTIVE_ACCOUNT, JSON.stringify(fixed));
    }
  },

  // Favorites (Canais de TV)
  async getFavorites(): Promise<number[]> {
    const json = await AsyncStorage.getItem(KEYS.FAVORITES);
    return json ? JSON.parse(json) : [];
  },

  async toggleFavorite(streamId: number): Promise<number[]> {
    const favs = await this.getFavorites();
    const index = favs.indexOf(streamId);
    let updated: number[];
    if (index >= 0) {
      updated = favs.filter((id) => id !== streamId);
    } else {
      updated = [...favs, streamId];
    }
    await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));
    return updated;
  },

  async getFavoriteChannels(): Promise<LiveChannel[]> {
    const json = await AsyncStorage.getItem(KEYS.FAVORITE_CHANNELS_DATA);
    if (!json) return [];
    try {
      const data: Record<string, LiveChannel> = JSON.parse(json);
      return Object.values(data);
    } catch {
      return [];
    }
  },

  async saveFavoriteChannel(channel: LiveChannel): Promise<void> {
    const favs = await this.getFavorites();
    if (!favs.includes(channel.stream_id)) {
      favs.push(channel.stream_id);
      await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(favs));
    }
    const json = await AsyncStorage.getItem(KEYS.FAVORITE_CHANNELS_DATA);
    const data: Record<string, LiveChannel> = json ? JSON.parse(json) : {};
    data[String(channel.stream_id)] = channel;
    await AsyncStorage.setItem(KEYS.FAVORITE_CHANNELS_DATA, JSON.stringify(data));
  },

  async removeFavoriteChannel(streamId: number): Promise<void> {
    const favs = await this.getFavorites();
    const updatedFavs = favs.filter((id) => id !== streamId);
    await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(updatedFavs));

    const json = await AsyncStorage.getItem(KEYS.FAVORITE_CHANNELS_DATA);
    if (json) {
      const data: Record<string, LiveChannel> = JSON.parse(json);
      delete data[String(streamId)];
      await AsyncStorage.setItem(KEYS.FAVORITE_CHANNELS_DATA, JSON.stringify(data));
    }
  },

  async toggleFavoriteChannel(channel: LiveChannel): Promise<boolean> {
    const favs = await this.getFavorites();
    const isFav = favs.includes(channel.stream_id);
    if (isFav) {
      await this.removeFavoriteChannel(channel.stream_id);
      return false;
    } else {
      await this.saveFavoriteChannel(channel);
      return true;
    }
  },

  // Favorites (Filmes VOD)
  async getMovieFavorites(): Promise<number[]> {
    const json = await AsyncStorage.getItem(KEYS.FAVORITES_MOVIES);
    return json ? JSON.parse(json) : [];
  },

  async getFavoriteMovies(): Promise<VodMovie[]> {
    const json = await AsyncStorage.getItem(KEYS.FAVORITE_MOVIES_DATA);
    if (!json) return [];
    try {
      const data: Record<string, VodMovie> = JSON.parse(json);
      return Object.values(data);
    } catch {
      return [];
    }
  },

  async saveFavoriteMovie(movie: VodMovie): Promise<void> {
    const favs = await this.getMovieFavorites();
    if (!favs.includes(movie.stream_id)) {
      favs.push(movie.stream_id);
      await AsyncStorage.setItem(KEYS.FAVORITES_MOVIES, JSON.stringify(favs));
    }
    const json = await AsyncStorage.getItem(KEYS.FAVORITE_MOVIES_DATA);
    const data: Record<string, VodMovie> = json ? JSON.parse(json) : {};
    data[String(movie.stream_id)] = movie;
    await AsyncStorage.setItem(KEYS.FAVORITE_MOVIES_DATA, JSON.stringify(data));
  },

  async removeFavoriteMovie(streamId: number): Promise<void> {
    const favs = await this.getMovieFavorites();
    const updatedFavs = favs.filter((id) => id !== streamId);
    await AsyncStorage.setItem(KEYS.FAVORITES_MOVIES, JSON.stringify(updatedFavs));

    const json = await AsyncStorage.getItem(KEYS.FAVORITE_MOVIES_DATA);
    if (json) {
      const data: Record<string, VodMovie> = JSON.parse(json);
      delete data[String(streamId)];
      await AsyncStorage.setItem(KEYS.FAVORITE_MOVIES_DATA, JSON.stringify(data));
    }
  },

  async toggleFavoriteMovie(movie: VodMovie): Promise<boolean> {
    const favs = await this.getMovieFavorites();
    const isFav = favs.includes(movie.stream_id);
    if (isFav) {
      await this.removeFavoriteMovie(movie.stream_id);
      return false;
    } else {
      await this.saveFavoriteMovie(movie);
      return true;
    }
  },

  async toggleMovieFavorite(streamId: number): Promise<number[]> {
    const favs = await this.getMovieFavorites();
    const index = favs.indexOf(streamId);
    let updated: number[];
    if (index >= 0) {
      updated = favs.filter((id) => id !== streamId);
    } else {
      updated = [...favs, streamId];
    }
    await AsyncStorage.setItem(KEYS.FAVORITES_MOVIES, JSON.stringify(updated));
    return updated;
  },

  // Favorites (Séries VOD)
  async getSeriesFavorites(): Promise<number[]> {
    const json = await AsyncStorage.getItem(KEYS.FAVORITES_SERIES);
    return json ? JSON.parse(json) : [];
  },

  async getFavoriteSeries(): Promise<SeriesItem[]> {
    const json = await AsyncStorage.getItem(KEYS.FAVORITE_SERIES_DATA);
    if (!json) return [];
    try {
      const data: Record<string, SeriesItem> = JSON.parse(json);
      return Object.values(data);
    } catch {
      return [];
    }
  },

  async saveFavoriteSeries(series: SeriesItem): Promise<void> {
    const favs = await this.getSeriesFavorites();
    if (!favs.includes(series.series_id)) {
      favs.push(series.series_id);
      await AsyncStorage.setItem(KEYS.FAVORITES_SERIES, JSON.stringify(favs));
    }
    const json = await AsyncStorage.getItem(KEYS.FAVORITE_SERIES_DATA);
    const data: Record<string, SeriesItem> = json ? JSON.parse(json) : {};
    data[String(series.series_id)] = series;
    await AsyncStorage.setItem(KEYS.FAVORITE_SERIES_DATA, JSON.stringify(data));
  },

  async removeFavoriteSeries(seriesId: number): Promise<void> {
    const favs = await this.getSeriesFavorites();
    const updatedFavs = favs.filter((id) => id !== seriesId);
    await AsyncStorage.setItem(KEYS.FAVORITES_SERIES, JSON.stringify(updatedFavs));

    const json = await AsyncStorage.getItem(KEYS.FAVORITE_SERIES_DATA);
    if (json) {
      const data: Record<string, SeriesItem> = JSON.parse(json);
      delete data[String(seriesId)];
      await AsyncStorage.setItem(KEYS.FAVORITE_SERIES_DATA, JSON.stringify(data));
    }
  },

  async toggleFavoriteSeries(series: SeriesItem): Promise<boolean> {
    const favs = await this.getSeriesFavorites();
    const isFav = favs.includes(series.series_id);
    if (isFav) {
      await this.removeFavoriteSeries(series.series_id);
      return false;
    } else {
      await this.saveFavoriteSeries(series);
      return true;
    }
  },

  async toggleSeriesFavorite(seriesId: number): Promise<number[]> {
    const favs = await this.getSeriesFavorites();
    const index = favs.indexOf(seriesId);
    let updated: number[];
    if (index >= 0) {
      updated = favs.filter((id) => id !== seriesId);
    } else {
      updated = [...favs, seriesId];
    }
    await AsyncStorage.setItem(KEYS.FAVORITES_SERIES, JSON.stringify(updated));
    return updated;
  },

  // Parental Control (PIN de 4 dígitos para Adultos/XXX)
  async getParentalPin(): Promise<string> {
    const pin = await AsyncStorage.getItem(KEYS.PARENTAL_PIN);
    return pin ? pin.trim() : '0000';
  },

  async setParentalPin(newPin: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.PARENTAL_PIN, newPin.trim());
  },

  async verifyParentalPin(inputPin: string): Promise<boolean> {
    const stored = await this.getParentalPin();
    return stored === inputPin.trim();
  },

  // Watch Progress (Continuar Assistindo)
  async saveWatchProgress(item: Partial<WatchProgressItem> & { id: number | string; positionSec: number; durationSec: number }): Promise<void> {
    const json = await AsyncStorage.getItem(KEYS.WATCH_PROGRESS);
    const progress: Record<string, WatchProgressItem> = json ? JSON.parse(json) : {};

    progress[String(item.id)] = {
      id: item.id,
      title: item.title || 'Continuar Assistindo',
      poster: item.poster,
      type: item.type || 'movie',
      positionSec: item.positionSec,
      durationSec: item.durationSec,
      extension: item.extension || 'mp4',
      timestamp: Date.now(),
      extra: item.extra,
    };

    await AsyncStorage.setItem(KEYS.WATCH_PROGRESS, JSON.stringify(progress));
  },

  async getWatchProgress(id: number | string): Promise<WatchProgressItem | null> {
    const json = await AsyncStorage.getItem(KEYS.WATCH_PROGRESS);
    if (!json) return null;
    const progress: Record<string, WatchProgressItem> = JSON.parse(json);
    return progress[String(id)] || null;
  },

  async getAllWatchProgress(): Promise<WatchProgressItem[]> {
    const json = await AsyncStorage.getItem(KEYS.WATCH_PROGRESS);
    if (!json) return [];
    try {
      const progress: Record<string, WatchProgressItem> = JSON.parse(json);
      return Object.values(progress)
        .filter((item) => item.positionSec > 10 && item.positionSec < (item.durationSec - 30))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  },

  // Minha Lista (Filmes e Séries adicionados à lista)
  async getMyList(): Promise<MediaListItem[]> {
    const json = await AsyncStorage.getItem(KEYS.MY_LIST);
    if (!json) return [];
    try {
      const list: MediaListItem[] = JSON.parse(json);
      return list.sort((a, b) => b.addedAt - a.addedAt);
    } catch {
      return [];
    }
  },

  async addToMyList(item: MediaListItem): Promise<void> {
    const list = await this.getMyList();
    const filtered = list.filter((i) => String(i.id) !== String(item.id));
    filtered.unshift({ ...item, addedAt: Date.now() });
    await AsyncStorage.setItem(KEYS.MY_LIST, JSON.stringify(filtered));
  },

  async removeFromMyList(id: number | string): Promise<void> {
    const list = await this.getMyList();
    const filtered = list.filter((i) => String(i.id) !== String(id));
    await AsyncStorage.setItem(KEYS.MY_LIST, JSON.stringify(filtered));
  },

  async isInMyList(id: number | string): Promise<boolean> {
    const list = await this.getMyList();
    return list.some((i) => String(i.id) === String(id));
  },

  async toggleMyList(item: MediaListItem): Promise<boolean> {
    const inList = await this.isInMyList(item.id);
    if (inList) {
      await this.removeFromMyList(item.id);
      return false;
    } else {
      await this.addToMyList(item);
      return true;
    }
  },

  // Assistir Depois (Filmes e Séries salvos para ver mais tarde)
  async getWatchLater(): Promise<MediaListItem[]> {
    const json = await AsyncStorage.getItem(KEYS.WATCH_LATER);
    if (!json) return [];
    try {
      const list: MediaListItem[] = JSON.parse(json);
      return list.sort((a, b) => b.addedAt - a.addedAt);
    } catch {
      return [];
    }
  },

  async addToWatchLater(item: MediaListItem): Promise<void> {
    const list = await this.getWatchLater();
    const filtered = list.filter((i) => String(i.id) !== String(item.id));
    filtered.unshift({ ...item, addedAt: Date.now() });
    await AsyncStorage.setItem(KEYS.WATCH_LATER, JSON.stringify(filtered));
  },

  async removeFromWatchLater(id: number | string): Promise<void> {
    const list = await this.getWatchLater();
    const filtered = list.filter((i) => String(i.id) !== String(id));
    await AsyncStorage.setItem(KEYS.WATCH_LATER, JSON.stringify(filtered));
  },

  async isInWatchLater(id: number | string): Promise<boolean> {
    const list = await this.getWatchLater();
    return list.some((i) => String(i.id) === String(id));
  },

  async toggleWatchLater(item: MediaListItem): Promise<boolean> {
    const inList = await this.isInWatchLater(item.id);
    if (inList) {
      await this.removeFromWatchLater(item.id);
      return false;
    } else {
      await this.addToWatchLater(item);
      return true;
    }
  },

  // App Settings
  async getSettings(): Promise<AppSettings> {
    const json = await AsyncStorage.getItem(KEYS.SETTINGS);
    return json ? { ...DEFAULT_SETTINGS, ...JSON.parse(json) } : DEFAULT_SETTINGS;
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  },
};
