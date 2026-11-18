import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  BackHandler,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FocusablePill } from './FocusablePill';
import { TVBackButton } from './TVBackButton';
import { colors } from '../../theme/colors';
import { tvColors, tvStyles } from '../../theme/tvTheme';
import { VodStream, Category } from '../../types/iptv';
import { xtreamClient } from '../../services/xtreamClient';
import { storage } from '../../services/storage';
import { enrichMediaMetadata, EnrichedMetadata } from '../../services/metadataEnricher';

export interface MovieVersionItem {
  stream_id: number;
  name: string;
  category_name?: string;
  category_id?: string;
  container_extension: string;
  added?: string;
  isCurrent: boolean;
  stream_icon?: string;
}

interface TVMovieDetailsModalProps {
  visible: boolean;
  movie: VodStream | null;
  currentCategoryName?: string;
  availableCategories?: Category[];
  favoriteIds?: number[];
  onClose: () => void;
  onPlayMovie: (movie: VodStream, containerExt?: string, streamUrl?: string, startPosition?: number) => void;
  onToggleFavorite?: (movie: VodStream) => void;
}

export const TVMovieDetailsModal: React.FC<TVMovieDetailsModalProps> = ({
  visible,
  movie,
  currentCategoryName = 'Filmes',
  availableCategories = [],
  favoriteIds = [],
  onClose,
  onPlayMovie,
  onToggleFavorite,
}) => {
  // Loading & Metadata States
  const [vodInfo, setVodInfo] = useState<any | null>(null);
  const [enrichedMeta, setEnrichedMeta] = useState<EnrichedMetadata | null>(null);

  // User Actions State
  const [isInWatchLater, setIsInWatchLater] = useState<boolean>(false);
  const [isInMyList, setIsInMyList] = useState<boolean>(false);
  const [hasProgress, setHasProgress] = useState<boolean>(false);
  const [watchProgress, setWatchProgress] = useState<any | null>(null);

  // Versions found across playlist
  const [versions, setVersions] = useState<MovieVersionItem[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);

  // Focus states
  const [focusedBtn, setFocusedBtn] = useState<string | null>(null);

  // Normalizer to compare titles without tags like (2026), [4K], etc.
  const normalizeTitle = (raw: string) => {
    return raw
      .toLowerCase()
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/\b(4k|uhd|fhd|hd|sd|dual|dublado|legendado|leg|dub)\b/gi, '')
      .replace(/[^a-z0-9]/g, ' ')
      .trim();
  };

  useEffect(() => {
    if (!visible || !movie) {
      setVodInfo(null);
      setEnrichedMeta(null);
      setVersions([]);
      return;
    }

    let isMounted = true;
    setIsLoadingVersions(true);

    const loadData = async () => {
      try {
        const [info, meta, inLater, inList, progress] = await Promise.all([
          xtreamClient.getVodInfo(movie.stream_id).catch(() => null),
          enrichMediaMetadata(movie.name, 'movie').catch(() => null),
          storage.isInWatchLater(movie.stream_id).catch(() => false),
          storage.isInMyList(movie.stream_id).catch(() => false),
          storage.getWatchProgress(movie.stream_id, movie.name).catch(() => null),
        ]);

        if (isMounted) {
          setVodInfo(info);
          setEnrichedMeta(meta);
          setIsInWatchLater(inLater);
          setIsInMyList(inList);
          setWatchProgress(progress);
          setHasProgress(
            !!(progress && progress.positionSec > 5 && (progress.durationSec === 0 || progress.positionSec < progress.durationSec - 30))
          );
        }

        // Search for alternate versions in other categories
        const currentNormTitle = normalizeTitle(movie.name);
        const foundVersions: MovieVersionItem[] = [
          {
            stream_id: movie.stream_id,
            name: movie.name,
            category_name: currentCategoryName || 'Filmes',
            category_id: movie.category_id,
            container_extension:
              info?.movie_data?.container_extension || movie.container_extension || 'mp4',
            added: info?.movie_data?.added || movie.added,
            isCurrent: true,
            stream_icon: movie.stream_icon,
          },
        ];

        // Query other categories from cache or API to find duplicates
        if (availableCategories.length > 1) {
          const otherCats = availableCategories
            .filter((c) => c.category_id !== movie.category_id && c.category_id !== 'favorites')
            .slice(0, 5);

          for (const cat of otherCats) {
            try {
              const catMovies = await xtreamClient.getVodStreams(cat.category_id);
              const match = catMovies.find(
                (m) =>
                  m.stream_id !== movie.stream_id &&
                  normalizeTitle(m.name) === currentNormTitle
              );
              if (match) {
                foundVersions.push({
                  stream_id: match.stream_id,
                  name: match.name,
                  category_name: cat.category_name,
                  category_id: match.category_id,
                  container_extension: match.container_extension || 'mp4',
                  added: match.added,
                  isCurrent: false,
                  stream_icon: match.stream_icon || movie.stream_icon,
                });
              }
            } catch {}
          }
        }

        if (isMounted) {
          setVersions(foundVersions);
          setIsLoadingVersions(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsLoadingVersions(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [visible, movie]);

  // Hardware Back Button Handler
  useEffect(() => {
    if (!visible) return;
    const onBackPress = () => {
      onClose();
      return true;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => handler.remove();
  }, [visible, onClose]);

  if (!visible || !movie) return null;

  // Metadata Resolution
  const infoData = vodInfo?.info || {};
  const movieData = vodInfo?.movie_data || {};

  const title = movie.name;
  const rating =
    infoData.rating ||
    enrichedMeta?.rating ||
    (movie.rating_5based ? (Number(movie.rating_5based) * 2).toFixed(1) : '8.2');
  const year =
    infoData.releasedate?.slice(0, 4) ||
    enrichedMeta?.year ||
    '2026';
  const synopsis =
    infoData.plot ||
    enrichedMeta?.plot ||
    infoData.description ||
    'Acompanhe esta grande produção cinematográfica com áudio multicanal e alta definição sem travamentos.';
  const backdrop =
    infoData.backdrop_path?.[0] ||
    enrichedMeta?.backdrop ||
    infoData.movie_image ||
    movie.stream_icon;
  const rawGenre = infoData.genre || enrichedMeta?.genre || currentCategoryName || 'Cinema TV, Comédia';
  const genres = rawGenre
    .split(/[,/•]/)
    .map((g: string) => g.trim())
    .filter((g: string) => g.length > 0)
    .slice(0, 3);

  const trailerId = infoData.youtube_trailer || '';

  const handleMyListToggle = async () => {
    const inList = await storage.toggleMyList({
      id: movie.stream_id,
      title: movie.name,
      poster: movie.stream_icon || enrichedMeta?.poster || undefined,
      backdrop: backdrop || undefined,
      type: 'movie',
      category_name: currentCategoryName,
      rating: String(rating),
      year: String(year),
      plot: synopsis,
      addedAt: Date.now(),
    });
    setIsInMyList(inList);
  };

  const handleWatchLaterToggle = async () => {
    const inLater = await storage.toggleWatchLater({
      id: movie.stream_id,
      title: movie.name,
      poster: movie.stream_icon || enrichedMeta?.poster || undefined,
      backdrop: backdrop || undefined,
      type: 'movie',
      category_name: currentCategoryName,
      rating: String(rating),
      year: String(year),
      plot: synopsis,
      addedAt: Date.now(),
    });
    setIsInWatchLater(inLater);
  };

  const handleOpenTrailer = () => {
    if (!trailerId) return;
    const url = trailerId.startsWith('http')
      ? trailerId
      : `https://www.youtube.com/watch?v=${trailerId}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleSelectVersion = (ver: MovieVersionItem) => {
    const selectedMovie: VodStream = {
      ...movie,
      stream_id: ver.stream_id,
      name: ver.name,
      container_extension: ver.container_extension,
    };
    onPlayMovie(selectedMovie, ver.container_extension);
  };

  const isFav = favoriteIds.includes(movie.stream_id);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop Background with Dark Cinema Gradient */}
        {backdrop ? (
          <Image
            source={{ uri: backdrop }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
        <LinearGradient
          colors={['rgba(7, 10, 18, 0.85)', 'rgba(7, 10, 18, 0.96)', '#070A12']}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Header: Standardized Back Button (Imagem 4) */}
        <View style={styles.topHeader}>
          <TVBackButton onPress={onClose} label="Voltar" />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section: Side-by-Side (Imagem 4 Standard) */}
          <View style={styles.heroRow}>
            {/* Left: Poster with "DESTAQUE" Badge */}
            <View style={styles.posterWrapper}>
              {movie.stream_icon ? (
                <Image
                  source={{ uri: movie.stream_icon }}
                  style={styles.posterImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.posterPlaceholder}>
                  <Ionicons name="film" size={40} color="#666" />
                </View>
              )}
              <View style={styles.destaqueBadge}>
                <Text style={styles.destaqueBadgeText}>DESTAQUE</Text>
              </View>
            </View>

            {/* Right: Info, Badges, Title, Synopsis, Actions */}
            <View style={styles.heroInfoCol}>
              {/* Badges: 4K UHD, ⭐ 8.2 • 2025 */}
              <View style={styles.metaBadgesRow}>
                <View style={styles.badge4K}>
                  <Text style={styles.badge4KText}>4K UHD</Text>
                </View>
                <Text style={styles.ratingText}>⭐ {rating}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.yearText}>{year}</Text>
              </View>

              {/* Title */}
              <Text style={styles.movieTitle} numberOfLines={2}>
                {title}
              </Text>

              {/* Synopsis */}
              <Text style={styles.synopsisText} numberOfLines={3}>
                {synopsis}
              </Text>

              {/* Tags: [ Cinema TV ] [ Comédia ] */}
              <View style={styles.genreRow}>
                {genres.map((genre: string, idx: number) => (
                  <View key={idx} style={styles.genreChip}>
                    <Text style={styles.genreChipText}>{genre}</Text>
                  </View>
                ))}
              </View>

              {/* Action Buttons Row (Imagem 4) */}
              <View style={styles.actionsRow}>
                {/* Assistir (Bright Yellow) */}
                <Pressable
                  focusable={true}
                  hasTVPreferredFocus={true}
                  onFocus={() => setFocusedBtn('play')}
                  onBlur={() => setFocusedBtn(null)}
                  onPress={() => onPlayMovie(
                    watchProgress?.id && String(watchProgress.id) !== String(movie.stream_id)
                      ? { ...movie, stream_id: Number(watchProgress.id) }
                      : movie,
                    watchProgress?.extension || movieData.container_extension || movie.container_extension,
                    watchProgress?.streamUrl,
                    watchProgress?.positionSec
                  )}
                  style={[
                    styles.watchButton,
                    focusedBtn === 'play' && styles.watchButtonFocused,
                  ]}
                >
                  <Ionicons name="play" size={20} color="#070A12" />
                  <Text style={styles.watchButtonText}>
                    {hasProgress ? 'Continuar Assistindo' : 'Assistir'}
                  </Text>
                </Pressable>

                {/* + Minha lista */}
                <Pressable
                  focusable={true}
                  onFocus={() => setFocusedBtn('list')}
                  onBlur={() => setFocusedBtn(null)}
                  onPress={handleMyListToggle}
                  style={[
                    styles.actionIconBtn,
                    focusedBtn === 'list' && styles.actionIconBtnFocused,
                  ]}
                >
                  <Ionicons
                    name={isInMyList ? 'checkmark' : 'add'}
                    size={20}
                    color={isInMyList ? colors.primary : '#FFFFFF'}
                  />
                  <Text style={[styles.actionBtnText, isInMyList && { color: colors.primary }]}>
                    {isInMyList ? 'Na lista' : 'Minha lista'}
                  </Text>
                </Pressable>

                {/* 🕒 Assistir depois */}
                <Pressable
                  focusable={true}
                  onFocus={() => setFocusedBtn('later')}
                  onBlur={() => setFocusedBtn(null)}
                  onPress={handleWatchLaterToggle}
                  style={[
                    styles.actionIconBtn,
                    focusedBtn === 'later' && styles.actionIconBtnFocused,
                  ]}
                >
                  <Ionicons
                    name={isInWatchLater ? 'time' : 'time-outline'}
                    size={20}
                    color={isInWatchLater ? colors.primary : '#FFFFFF'}
                  />
                  <Text style={[styles.actionBtnText, isInWatchLater && { color: colors.primary }]}>
                    {isInWatchLater ? 'Salvo' : 'Assistir depois'}
                  </Text>
                </Pressable>

                {/* ⭐ Favoritar */}
                <Pressable
                  focusable={true}
                  onFocus={() => setFocusedBtn('fav')}
                  onBlur={() => setFocusedBtn(null)}
                  onPress={() => onToggleFavorite?.(movie)}
                  style={[
                    styles.actionIconBtn,
                    focusedBtn === 'fav' && styles.actionIconBtnFocused,
                  ]}
                >
                  <Ionicons
                    name={isFav ? 'star' : 'star-outline'}
                    size={20}
                    color={isFav ? '#FFD700' : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      isFav && { color: '#FFD700' },
                    ]}
                  >
                    Favoritar
                  </Text>
                </Pressable>

                {/* [ 📺 Trailer ] */}
                {trailerId ? (
                  <Pressable
                    focusable={true}
                    onFocus={() => setFocusedBtn('trailer')}
                    onBlur={() => setFocusedBtn(null)}
                    onPress={handleOpenTrailer}
                    style={[
                      styles.trailerButton,
                      focusedBtn === 'trailer' && styles.actionIconBtnFocused,
                    ]}
                  >
                    <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                    <Text style={styles.trailerButtonText}>Trailer</Text>
                  </Pressable>
                ) : null}

                {/* Rating & Year Badge */}
                <View style={styles.ratingBox}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingNumber}>{rating}</Text>
                  <Text style={styles.ratingDivider}>|</Text>
                  <Text style={styles.ratingYear}>{year}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Lower Section: Aba Versões (Imagem 4 Standard) */}
          <View style={styles.versionsSection}>
            <View style={styles.tabHeaderRow}>
              <FocusablePill
                label="Versões"
                badge={versions.length || 1}
                variant="tab"
                isSelected={true}
                onPress={() => {}}
              />
            </View>

            {isLoadingVersions ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingVersionsText}>
                  Buscando versões disponíveis na lista...
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.versionsScrollRow}
                >
                  {versions.map((ver) => (
                    <VersionCardItem
                      key={ver.stream_id}
                      version={ver}
                      onPress={() => handleSelectVersion(ver)}
                    />
                  ))}
                </ScrollView>

                <Text style={styles.versionsFooterHint}>
                  💡 O mesmo título em outras versões da sua lista. Se uma não abrir, tente outra.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

// Item Card de Versão (Imagem 4 Standard)
function VersionCardItem({
  version,
  onPress,
}: {
  version: MovieVersionItem;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.versionCard,
        version.isCurrent && styles.versionCardCurrent,
        isFocused && styles.versionCardFocused,
      ]}
    >
      {/* Thumbnail */}
      <View style={styles.versionPosterWrapper}>
        {version.stream_icon ? (
          <Image
            source={{ uri: version.stream_icon }}
            style={styles.versionPoster}
            contentFit="cover"
          />
        ) : (
          <View style={styles.versionPosterPlaceholder}>
            <Ionicons name="film-outline" size={24} color="#888" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.versionInfo}>
        {version.isCurrent && (
          <View style={styles.badgeYouAreHere}>
            <Text style={styles.badgeYouAreHereText}>VOCÊ ESTÁ AQUI</Text>
          </View>
        )}

        <View style={styles.versionTitleRow}>
          <Ionicons name="film" size={16} color="#FFD700" style={{ marginRight: 6 }} />
          <Text style={styles.versionTitle} numberOfLines={1}>
            Versão padrão
          </Text>
        </View>

        <Text style={styles.versionCategory} numberOfLines={1}>
          {version.category_name || 'Filmes'}
        </Text>

        <Text style={styles.versionMeta} numberOfLines={1}>
          {version.container_extension.toUpperCase()} • Adicionado recentemente
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A12',
  },
  topHeader: {
    paddingTop: 18,
    paddingHorizontal: 28,
    zIndex: 10,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 36,
  },

  /* Hero Section Side-by-Side (Imagem 4) */
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  posterWrapper: {
    width: 150,
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#151C30',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: 24,
    position: 'relative',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destaqueBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.secondary, // #A855F7 (Cores do sistema)
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  destaqueBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0.5,
  },

  heroInfoCol: {
    flex: 1,
  },
  metaBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badge4K: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  badge4KText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: 'bold',
  },
  metaDot: {
    color: '#64748B',
  },
  yearText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  movieTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  synopsisText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 12,
    maxWidth: '92%',
  },
  genreRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  genreChip: {
    backgroundColor: 'rgba(21, 28, 48, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2845',
  },
  genreChipText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Actions Row */
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  watchButton: {
    ...tvStyles.watchButton,
  },
  watchButtonFocused: {
    ...tvStyles.watchButtonFocused,
  },
  watchButtonText: {
    ...tvStyles.watchButtonText,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  actionIconBtnFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
    transform: [{ scale: 1.06 }],
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  trailerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 28, 48, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 0, 0, 0.4)',
  },
  trailerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    gap: 6,
  },
  ratingNumber: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 15,
  },
  ratingDivider: {
    color: '#64748B',
    fontWeight: '600',
  },
  ratingYear: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 14,
  },

  /* Lower Versions Section (Imagem 4) */
  versionsSection: {
    marginTop: 10,
    backgroundColor: 'rgba(14, 19, 34, 0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  versionsScrollRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 4,
  },
  versionCard: {
    flexDirection: 'row',
    width: 290,
    backgroundColor: 'rgba(21, 28, 48, 0.75)',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1E2845',
    padding: 10,
    alignItems: 'center',
  },
  versionCardCurrent: {
    borderColor: '#00E5FF',
  },
  versionCardFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
    transform: [{ scale: 1.05 }],
  },
  versionPosterWrapper: {
    width: 50,
    height: 70,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1E2845',
    marginRight: 12,
  },
  versionPoster: {
    width: '100%',
    height: '100%',
  },
  versionPosterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionInfo: {
    flex: 1,
  },
  badgeYouAreHere: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeYouAreHereText: {
    color: '#070A12',
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  versionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  versionTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  versionCategory: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  versionMeta: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  versionsFooterHint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  loadingVersionsText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
  },
});
