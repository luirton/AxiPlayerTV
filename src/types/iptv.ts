export interface XtreamUserInfo {
  username: string;
  password?: string;
  message?: string;
  auth: number;
  status: string;
  exp_date?: string;
  is_trial?: string;
  active_cons?: string;
  created_at?: string;
  max_connections?: string;
  allowed_output_formats?: string[];
}

export interface XtreamServerInfo {
  url?: string;
  port?: string;
  https_port?: string;
  server_protocol?: string;
  rtmp_port?: string;
  timezone?: string;
  timestamp_now?: number;
  time_now?: string;
}

export interface XtreamAuthResponse {
  user_info: XtreamUserInfo;
  server_info: XtreamServerInfo;
}

export interface IptvCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export type Category = IptvCategory;
export type LiveStream = LiveChannel;
export type VodStream = VodMovie;
export type SeriesStream = SeriesItem;

export interface LiveChannel {
  num?: number;
  name: string;
  stream_type?: string;
  stream_id: number;
  stream_icon?: string;
  epg_channel_id?: string;
  added?: string;
  category_id: string;
  custom_sid?: string;
  tv_archive?: number;
  direct_source?: string;
  tv_archive_duration?: number;
}

export interface VodMovie {
  num?: number;
  name: string;
  stream_type?: string;
  stream_id: number;
  stream_icon?: string;
  rating?: string;
  rating_5based?: number;
  added?: string;
  category_id: string;
  container_extension?: string;
  custom_sid?: string;
  direct_source?: string;
}

export interface SeriesItem {
  num?: number;
  name: string;
  series_id: number;
  cover?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  last_modified?: string;
  rating?: string;
  rating_5based?: number;
  backdrop_path?: string[];
  youtube_trailer?: string;
  episode_run_time?: string;
  category_id: string;
}

export interface SeriesEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info?: {
    movie_image?: string;
    plot?: string;
    duration_secs?: number;
    duration?: string;
    releasedate?: string;
    rating?: number;
  };
  season: number;
}

export interface SeriesInfoResponse {
  seasons: {
    air_date?: string;
    episode_count: number;
    id: number;
    name: string;
    overview?: string;
    season_number: number;
    cover?: string;
  }[];
  info: {
    name: string;
    cover: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releaseDate: string;
    rating: string;
    backdrop_path: string[];
    youtube_trailer: string;
  };
  episodes: Record<string, SeriesEpisode[]>;
}

export interface EpgProgram {
  id: string;
  epg_id: string;
  title: string;
  lang: string;
  start: string;
  end: string;
  description: string;
  channel_id: string;
  start_timestamp: number;
  stop_timestamp: number;
}

export interface SavedAccount {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password?: string;
  isM3u?: boolean;
  m3uUrl?: string;
  createdAt: number;
  lastLogin: number;
}
