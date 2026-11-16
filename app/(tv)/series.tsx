import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
  BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FocusableCard } from '../../src/components/tv/FocusableCard';
import { FocusableButton } from '../../src/components/tv/FocusableButton';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';
import {
  Category,
  SeriesStream,
  SeriesItem,
  SeriesInfoResponse,
  SeriesEpisode,
} from '../../src/types/iptv';

export default function TVSeriesScreen() {
  const router = useRouter();

  // Catalog State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [seriesList, setSeriesList] = useState<SeriesStream[]>([]);
  const [focusedSeries, setFocusedSeries] = useState<SeriesStream | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Episodes & Season Navigation State
  const [selectedSeries, setSelectedSeries] = useState<SeriesStream | null>(null);
  const [seriesDetails, setSeriesDetails] = useState<SeriesInfoResponse | null>(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<string>('1');
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [focusedEpisode, setFocusedEpisode] = useState<SeriesEpisode | null>(null);

  useEffect(() => {
    loadSeriesCategories();
  }, []);

  const loadSeriesCategories = async () => {
    try {
      setIsLoading(true);
      const profile = await storage.getActiveProfile();
      if (!profile) return;
      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

      const [favIds, cats] = await Promise.all([
        storage.getSeriesFavorites(),
        xtreamClient.getSeriesCategories(),
      ]);

      setFavoriteIds(favIds);

      const allCategories: Category[] = [];
      if (favIds.length > 0) {
        allCategories.push({
          category_id: 'favorites',
          category_name: '⭐ Favoritos',
        });
      }
      allCategories.push(...cats);
      setCategories(allCategories);

      if (allCategories.length > 0) {
        setSelectedCategory(allCategories[0]);
        loadSeries(allCategories[0].category_id);
      }
    } catch (err) {
      console.error('Error loading series categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSeries = async (categoryId: string) => {
    try {
      let list: SeriesStream[] = [];
      if (categoryId === 'favorites') {
        list = await storage.getFavoriteSeries();
      } else {
        list = await xtreamClient.getSeries(categoryId);
      }

      setSeriesList(list);
      if (list.length > 0) {
        setFocusedSeries(list[0]);
      } else {
        setFocusedSeries(null);
      }
    } catch (err) {
      console.error('Error loading series:', err);
    }
  };

  // Open Series Seasons & Episodes view
  const handleOpenSeriesEpisodes = async (series: SeriesStream) => {
    setSelectedSeries(series);
    setIsLoadingEpisodes(true);
    try {
      const data = await xtreamClient.getSeriesInfo(series.series_id);
      setSeriesDetails(data);

      // Determine initial season number
      const seasonKeys = data?.episodes ? Object.keys(data.episodes) : [];
      const firstSeason = seasonKeys.length > 0 ? seasonKeys[0] : '1';
      setSelectedSeasonNumber(firstSeason);

      const eps = data?.episodes?.[firstSeason] || [];
      if (eps.length > 0) {
        setFocusedEpisode(eps[0]);
      } else {
        setFocusedEpisode(null);
      }
    } catch (err) {
      console.error('Error loading series info:', err);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  // Close Episodes View and return to Series Catalog
  const handleCloseEpisodes = () => {
    setSelectedSeries(null);
    setSeriesDetails(null);
    setFocusedEpisode(null);
  };

  // Play Episode
  const handlePlayEpisode = (episode: SeriesEpisode) => {
    if (!selectedSeries) return;
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(episode.id),
        type: 'series',
        name: `${selectedSeries.name} • T${episode.season}E${episode.episode_num}: ${episode.title}`,
        container: episode.container_extension || 'mp4',
      },
    });
  };

  // Toggle Favorite
  const handleToggleFavorite = async (series: SeriesStream) => {
    await storage.toggleFavoriteSeries(series);
    const updatedFavIds = await storage.getSeriesFavorites();
    setFavoriteIds(updatedFavIds);

    if (selectedCategory?.category_id === 'favorites') {
      const updatedList = await storage.getFavoriteSeries();
      setSeriesList(updatedList);
      if (updatedList.length > 0) {
        setFocusedSeries(updatedList[0]);
      } else {
        setFocusedSeries(null);
      }
    }
  };

  // Handle Back Button
  useEffect(() => {
    const onBackPress = () => {
      if (selectedSeries) {
        handleCloseEpisodes();
        return true;
      }
      return false;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => handler.remove();
  }, [selectedSeries]);

  const isCurrentFav = focusedSeries ? favoriteIds.includes(focusedSeries.series_id) : false;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando Catálogo de Séries...</Text>
      </View>
    );
  }

  // ==========================================
  // VIEW B: NAVEGADOR DE TEMPORADAS E EPISÓDIOS
  // ==========================================
  if (selectedSeries) {
    const seasonKeys = seriesDetails?.episodes ? Object.keys(seriesDetails.episodes) : [];
    const currentEpisodes = seriesDetails?.episodes?.[selectedSeasonNumber] || [];
    const seriesBackdrop =
      seriesDetails?.info?.backdrop_path?.[0] ||
      seriesDetails?.info?.cover ||
      selectedSeries.cover;

    return (
      <View style={styles.container}>
        {/* Header Preview of Selected Series */}
        <View style={styles.episodesHeader}>
          {seriesBackdrop ? (
            <Image
              source={{ uri: seriesBackdrop }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : null}

          <LinearGradient
            colors={['transparent', 'rgba(5, 5, 5, 0.85)', '#050505']}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(5, 5, 5, 0.96)', 'rgba(5, 5, 5, 0.65)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.episodesHeaderContent}>
            <BackToCatalogButton onPress={handleCloseEpisodes} />

            <Text style={styles.seriesDetailTitle} numberOfLines={1}>
              {selectedSeries.name}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.badgeHD}>
                <Text style={styles.badgeHDText}>Série Completa</Text>
              </View>
              <Text style={styles.ratingText}>
                ⭐{' '}
                {seriesDetails?.info?.rating ||
                  (selectedSeries.rating_5based
                    ? (Number(selectedSeries.rating_5based) * 2).toFixed(1)
                    : '8.8')}
              </Text>
              <Text style={styles.yearText}>
                • {seasonKeys.length} {seasonKeys.length === 1 ? 'Temporada' : 'Temporadas'}
              </Text>
              {seriesDetails?.info?.genre ? (
                <Text style={styles.genreText} numberOfLines={1}>
                  • {seriesDetails.info.genre}
                </Text>
              ) : null}
            </View>

            <Text style={styles.synopsisText} numberOfLines={2}>
              {focusedEpisode?.info?.plot ||
                seriesDetails?.info?.plot ||
                'Escolha uma temporada e selecione um episódio para assistir.'}
            </Text>
          </View>
        </View>

        {isLoadingEpisodes ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando episódios...</Text>
          </View>
        ) : (
          <>
            {/* Seletor Horizontal de Temporadas */}
            <View style={styles.seasonBar}>
              <Text style={styles.seasonBarLabel}>TEMPORADAS:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.seasonScroll}
              >
                {seasonKeys.map((seasonKey) => {
                  const isSelected = selectedSeasonNumber === seasonKey;
                  const seasonEpsCount = seriesDetails?.episodes?.[seasonKey]?.length || 0;
                  return (
                    <SeasonPill
                      key={seasonKey}
                      label={`Temporada ${seasonKey} (${seasonEpsCount})`}
                      isSelected={isSelected}
                      onPress={() => {
                        setSelectedSeasonNumber(seasonKey);
                        const eps = seriesDetails?.episodes?.[seasonKey] || [];
                        if (eps.length > 0) setFocusedEpisode(eps[0]);
                      }}
                    />
                  );
                })}
              </ScrollView>
            </View>

            {/* Carrossel Horizontal de Episódios */}
            <View style={styles.episodesGrid}>
              <FlatList
                horizontal
                data={currentEpisodes}
                keyExtractor={(item) => String(item.id)}
                showsHorizontalScrollIndicator={false}
                initialNumToRender={8}
                maxToRenderPerBatch={12}
                windowSize={7}
                contentContainerStyle={styles.episodesScroll}
                renderItem={({ item, index }) => (
                  <EpisodeCard
                    episode={item}
                    index={index + 1}
                    fallbackCover={selectedSeries.cover}
                    onFocus={() => setFocusedEpisode(item)}
                    onPress={() => handlePlayEpisode(item)}
                  />
                )}
              />
            </View>
          </>
        )}
      </View>
    );
  }

  // ==========================================
  // VIEW A: CATÁLOGO GERAL DE SÉRIES
  // ==========================================
  const backdropUri = focusedSeries?.backdrop_path?.[0] || focusedSeries?.cover;

  return (
    <View style={styles.container}>
      {/* 1. Top Section: Cinema Dynamic Backdrop & Series Info */}
      <View style={styles.previewHeader}>
        {backdropUri ? (
          <Image
            source={{ uri: backdropUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
        ) : null}

        <LinearGradient
          colors={['transparent', 'rgba(5, 5, 5, 0.85)', '#050505']}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(5, 5, 5, 0.96)', 'rgba(5, 5, 5, 0.65)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.previewContent}>
          <Text style={styles.categoryBadge}>
            {selectedCategory?.category_name.toUpperCase() || 'SÉRIES'}
          </Text>

          <Text style={styles.previewTitle} numberOfLines={2}>
            {focusedSeries?.name || 'Selecione uma série'}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.badgeHD}>
              <Text style={styles.badgeHDText}>Série Completa</Text>
            </View>
            <Text style={styles.ratingText}>
              ⭐{' '}
              {focusedSeries?.rating_5based
                ? (Number(focusedSeries.rating_5based) * 2).toFixed(1)
                : '8.6'}
            </Text>
            <Text style={styles.yearText}>• Temporadas & Episódios</Text>
            {focusedSeries?.genre ? (
              <Text style={styles.genreText} numberOfLines={1}>
                • {focusedSeries.genre}
              </Text>
            ) : null}
          </View>

          <Text style={styles.synopsisText} numberOfLines={3}>
            {focusedSeries?.plot ||
              'Navegue entre as séries com o controle remoto. Pressione OK ou clique em "Ver Episódios" para selecionar temporadas.'}
          </Text>

          {/* Action Buttons */}
          {focusedSeries && (
            <View style={styles.actionRow}>
              <FocusableButton
                label="VER TEMPORADAS E EPISÓDIOS"
                icon="albums-outline"
                variant="primary"
                onPress={() => handleOpenSeriesEpisodes(focusedSeries)}
                style={styles.actionBtn}
              />

              <FocusableButton
                label={isCurrentFav ? 'FAVORITADO' : 'FAVORITAR'}
                icon={isCurrentFav ? 'star' : 'star-outline'}
                variant="secondary"
                onPress={() => handleToggleFavorite(focusedSeries)}
                style={styles.actionBtn}
              />
            </View>
          )}
        </View>
      </View>

      {/* 2. Horizontal Categories Navigation Bar */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory?.category_id === cat.category_id;
            return (
              <SeriesCategoryPill
                key={cat.category_id}
                title={cat.category_name}
                isSelected={isSelected}
                onPress={() => {
                  setSelectedCategory(cat);
                  loadSeries(cat.category_id);
                }}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Horizontal Carousel of Series Posters */}
      <View style={styles.seriesGrid}>
        <FlatList
          horizontal
          data={seriesList}
          keyExtractor={(item) => String(item.series_id)}
          showsHorizontalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={15}
          windowSize={7}
          contentContainerStyle={styles.seriesScroll}
          renderItem={({ item }) => {
            const isFav = favoriteIds.includes(item.series_id);
            return (
              <FocusableCard
                title={item.name}
                imageUrl={item.cover}
                rating={
                  item.rating_5based
                    ? (Number(item.rating_5based) * 2).toFixed(1)
                    : undefined
                }
                width={135}
                aspectRatio={2 / 3}
                badge={isFav ? '⭐' : undefined}
                onFocus={() => setFocusedSeries(item)}
                onPress={() => handleOpenSeriesEpisodes(item)}
              />
            );
          }}
        />
      </View>
    </View>
  );
}

function BackToCatalogButton({ onPress }: { onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.backToCatalogBtn, isFocused && styles.btnFocused]}
    >
      <Ionicons name="arrow-back" size={16} color="#FFF" />
      <Text style={styles.backToCatalogText}>Voltar ao Catálogo</Text>
    </Pressable>
  );
}

// Item de Categoria
function SeriesCategoryPill({
  title,
  isSelected,
  onPress,
}: {
  title: string;
  isSelected: boolean;
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
        styles.pillContainer,
        isSelected && styles.pillSelected,
        isFocused && styles.pillFocused,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          isSelected && styles.pillTextSelected,
          isFocused && styles.pillTextFocused,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// Item de Temporada
function SeasonPill({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
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
        styles.seasonPill,
        isSelected && styles.seasonPillSelected,
        isFocused && styles.pillFocused,
      ]}
    >
      <Text
        style={[
          styles.seasonPillText,
          isSelected && styles.seasonPillTextSelected,
          isFocused && styles.pillTextFocused,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Card de Episódio (16:9 Widescreen)
function EpisodeCard({
  episode,
  index,
  fallbackCover,
  onFocus,
  onPress,
}: {
  episode: SeriesEpisode;
  index: number;
  fallbackCover?: string;
  onFocus: () => void;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const imageSource = episode.info?.movie_image || fallbackCover;

  return (
    <Pressable
      focusable={true}
      onFocus={() => {
        setIsFocused(true);
        onFocus();
      }}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.episodeCard, isFocused && styles.episodeCardFocused]}
    >
      <View style={styles.episodeThumbContainer}>
        {imageSource ? (
          <Image
            source={{ uri: imageSource }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={styles.episodeThumbPlaceholder}>
            <Ionicons name="play-circle-outline" size={32} color="#666" />
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.episodeBadge}>
          <Text style={styles.episodeBadgeText}>
            EP. {String(episode.episode_num || index).padStart(2, '0')}
          </Text>
        </View>

        {episode.info?.duration ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationBadgeText}>{episode.info.duration}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.episodeInfo}>
        <Text style={[styles.episodeTitle, isFocused && styles.episodeTitleFocused]} numberOfLines={1}>
          {episode.title}
        </Text>
        <Text style={styles.episodePlot} numberOfLines={2}>
          {episode.info?.plot || 'Reproduzir episódio com áudio estéreo/5.1.'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 16,
    fontSize: 14,
  },
  previewHeader: {
    height: 250,
    backgroundColor: '#0E0E14',
    position: 'relative',
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: 18,
  },
  previewContent: {
    maxWidth: '68%',
    zIndex: 2,
  },
  categoryBadge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  badgeHD: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeHDText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  yearText: {
    color: '#8E8E93',
    fontSize: 12,
    marginRight: 6,
  },
  genreText: {
    color: '#A0A0A5',
    fontSize: 12,
    flex: 1,
  },
  synopsisText: {
    color: '#B0B0B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    marginRight: 8,
  },
  categoryBar: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#16161C',
    justifyContent: 'center',
  },
  categoryScroll: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  pillContainer: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#16161C',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillSelected: {
    backgroundColor: 'rgba(255, 106, 0, 0.18)',
    borderColor: colors.primary,
  },
  pillFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(255, 160, 0, 0.3)',
    transform: [{ scale: 1.05 }],
  },
  pillText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  pillTextFocused: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  seriesGrid: {
    flex: 1,
    paddingVertical: 14,
  },
  seriesScroll: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },

  // Episodes Header
  episodesHeader: {
    height: 220,
    backgroundColor: '#0E0E14',
    position: 'relative',
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: 14,
  },
  episodesHeaderContent: {
    maxWidth: '75%',
    zIndex: 2,
  },
  backToCatalogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  btnFocused: {
    borderColor: colors.focusRing,
    backgroundColor: colors.focusRing,
  },
  backToCatalogText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  seriesDetailTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },

  // Season Bar
  seasonBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#16161C',
  },
  seasonBarLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginRight: 12,
  },
  seasonScroll: {
    alignItems: 'center',
  },
  seasonPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#181820',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  seasonPillSelected: {
    backgroundColor: 'rgba(255, 106, 0, 0.2)',
    borderColor: colors.primary,
  },
  seasonPillText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  seasonPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  // Episodes Grid & Cards
  episodesGrid: {
    flex: 1,
    paddingVertical: 14,
  },
  episodesScroll: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  episodeCard: {
    width: 220,
    backgroundColor: '#111116',
    borderRadius: 8,
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  episodeCardFocused: {
    borderColor: colors.focusRing,
    transform: [{ scale: 1.05 }],
  },
  episodeThumbContainer: {
    height: 124,
    backgroundColor: '#1A1A22',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(229, 45, 39, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  episodeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationBadgeText: {
    color: '#E0E0E5',
    fontSize: 9,
    fontWeight: '600',
  },
  episodeInfo: {
    padding: 10,
  },
  episodeTitle: {
    color: '#DDDDDF',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  episodeTitleFocused: {
    color: colors.primaryAmber,
  },
  episodePlot: {
    color: '#7E7E84',
    fontSize: 11,
    lineHeight: 15,
  },
});
