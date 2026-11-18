import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TVHeader } from '../../src/components/tv/TVHeader';
import { FocusableCard } from '../../src/components/tv/FocusableCard';
import { FocusablePill } from '../../src/components/tv/FocusablePill';
import { TVMovieDetailsModal } from '../../src/components/tv/TVMovieDetailsModal';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage, WatchProgressItem, MediaListItem } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';
import { tvColors, tvStyles } from '../../src/theme/tvTheme';
import { LiveStream, VodStream, SeriesStream, LiveChannel, Category } from '../../src/types/iptv';

interface FeaturedCategoryItem {
  id: string;
  name: string;
  type: 'movie' | 'series' | 'live';
  icon: keyof typeof Ionicons.glyphMap;
}

export default function TVHomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [liveChannels, setLiveChannels] = useState<LiveStream[]>([]);
  const [movies, setMovies] = useState<VodStream[]>([]);
  const [series, setSeries] = useState<SeriesStream[]>([]);
  const [heroItem, setHeroItem] = useState<VodStream | null>(null);

  // Collections state
  const [favoriteChannels, setFavoriteChannels] = useState<LiveChannel[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchProgressItem[]>([]);
  const [watchLaterList, setWatchLaterList] = useState<MediaListItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [featuredCategories, setFeaturedCategories] = useState<FeaturedCategoryItem[]>([]);

  // Movie Details Modal State (Imagem 8 Standard)
  const [selectedMovieForDetails, setSelectedMovieForDetails] = useState<VodStream | null>(null);

  // Focus states
  const [isHeroWatchFocused, setIsHeroWatchFocused] = useState(false);
  const [isHeroDetailsFocused, setIsHeroDetailsFocused] = useState(false);

  useEffect(() => {
    loadHomeData();
  }, []);

  // Reload collections whenever screen regains focus
  useFocusEffect(
    useCallback(() => {
      loadCollections();
    }, [])
  );

  const loadCollections = async () => {
    try {
      const [favChs, progress, wl] = await Promise.all([
        storage.getFavoriteChannels().catch(() => []),
        storage.getAllWatchProgress().catch(() => []),
        storage.getWatchLater().catch(() => []),
      ]);
      setFavoriteChannels(favChs);
      setContinueWatching(progress);
      setWatchLaterList(wl);
    } catch (e) {
      console.warn('Erro ao carregar coleções da TV:', e);
    }
  };

  const loadHomeData = async () => {
    try {
      setIsLoading(true);
      const profile = await storage.getActiveProfile();
      if (!profile) {
        router.replace('/login');
        return;
      }

      // Initialize Xtream credentials
      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

      // Carga sob demanda por categoria: evita download maciço de JSON de 25MB+ no boot da TV
      const [liveRes, vodCatsRes, seriesCatsRes] = await Promise.all([
        xtreamClient.getLiveStreams().catch(() => []),
        xtreamClient.getVodCategories().catch(() => []),
        xtreamClient.getSeriesCategories().catch(() => []),
      ]);

      const allVodCats: Category[] = Array.isArray(vodCatsRes) ? vodCatsRes : [];
      const allSeriesCats: Category[] = Array.isArray(seriesCatsRes) ? seriesCatsRes : [];
      setAvailableCategories(allVodCats);

      // Build Featured Categories list to replace the streaming brands (Imagem 3)
      const featCats: FeaturedCategoryItem[] = [];

      // Top VOD Categories
      allVodCats.slice(0, 6).forEach((c) => {
        featCats.push({
          id: c.category_id,
          name: c.category_name,
          type: 'movie',
          icon: 'film-outline',
        });
      });

      // Top Series Categories
      allSeriesCats.slice(0, 4).forEach((c) => {
        featCats.push({
          id: c.category_id,
          name: c.category_name,
          type: 'series',
          icon: 'tv-outline',
        });
      });

      setFeaturedCategories(featCats);

      const firstVodCatId = allVodCats.length > 0 ? allVodCats[0].category_id : undefined;
      const firstSeriesCatId = allSeriesCats.length > 0 ? allSeriesCats[0].category_id : undefined;

      const [vodRes, seriesRes] = await Promise.all([
        firstVodCatId
          ? xtreamClient.getVodStreams(firstVodCatId).catch(() => [])
          : xtreamClient.getVodStreams().catch(() => []),
        firstSeriesCatId
          ? xtreamClient.getSeries(firstSeriesCatId).catch(() => [])
          : xtreamClient.getSeries().catch(() => []),
      ]);

      const topLive = (liveRes || []).slice(0, 15);
      const topMovies = (vodRes || []).slice(0, 20);
      const topSeries = (seriesRes || []).slice(0, 20);

      setLiveChannels(topLive);
      setMovies(topMovies);
      setSeries(topSeries);

      // Sincroniza marcação de recarga de lista da TV
      storage.markPlaylistReloaded().catch(() => {});

      // Spotlight Hero item
      if (topMovies.length > 0) {
        const poolSize = Math.min(topMovies.length, 10);
        const randomIdx = Math.floor(Math.random() * poolSize);
        setHeroItem(topMovies[randomIdx] || topMovies[0]);
      }

      await loadCollections();
    } catch (err) {
      console.error('Error loading TV home data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPlayer = (streamId: number | string, type: 'live' | 'movie' | 'series', name: string) => {
    router.push({
      pathname: '/player/[id]',
      params: { id: String(streamId), type, name },
    });
  };

  const handleMoviePress = (movie: VodStream) => {
    setSelectedMovieForDetails(movie);
  };

  const handlePlayFromDetails = (movie: VodStream, containerExt?: string) => {
    setSelectedMovieForDetails(null);
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(movie.stream_id),
        type: 'movie',
        name: movie.name,
        container: containerExt || movie.container_extension || 'mp4',
        icon: movie.stream_icon || '',
      },
    });
  };

  const handleCategoryPress = (cat: FeaturedCategoryItem) => {
    if (cat.type === 'movie') {
      router.push({
        pathname: '/(tv)/movies',
        params: { categoryId: cat.id },
      });
    } else if (cat.type === 'series') {
      router.push({
        pathname: '/(tv)/series',
        params: { categoryId: cat.id },
      });
    } else {
      router.push('/(tv)/live');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando conteúdos da TV...</Text>
      </View>
    );
  }

  const heroRating = heroItem?.rating_5based
    ? (Number(heroItem.rating_5based) * 2).toFixed(1)
    : '8.4';

  return (
    <View style={styles.container}>
      <TVHeader title="Axi Player TV" subtitle="Início & Lançamentos" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Spotlight Hero Banner (Imagem 3: Novo Layout com Pôster Menor e Descrição ao Lado) */}
        {heroItem && (
          <View style={styles.heroBox}>
            {/* Background Backdrop Blur/Gradient */}
            {heroItem.stream_icon ? (
              <Image
                source={{ uri: heroItem.stream_icon }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : null}
            <LinearGradient
              colors={['rgba(7, 10, 18, 0.88)', 'rgba(7, 10, 18, 0.98)', '#070A12']}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.heroInnerRow}>
              {/* Imagem Menor do Pôster à Esquerda */}
              <View style={styles.heroPosterWrapper}>
                {heroItem.stream_icon ? (
                  <Image
                    source={{ uri: heroItem.stream_icon }}
                    style={styles.heroPosterImg}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.heroPosterPlaceholder}>
                    <Ionicons name="film" size={40} color="#666" />
                  </View>
                )}
                <View style={styles.heroPosterBadge}>
                  <Text style={styles.heroPosterBadgeText}>DESTAQUE</Text>
                </View>
              </View>

              {/* Informações e Descrição ao Lado (Direita) */}
              <View style={styles.heroContentCol}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.badgeHD}>
                    <Text style={styles.badgeHDText}>4K UHD</Text>
                  </View>
                  <Text style={styles.heroRating}>⭐ {heroRating}</Text>
                  <Text style={styles.heroDot}>•</Text>
                  <Text style={styles.heroYear}>2025</Text>
                </View>

                <Text style={styles.heroTitle} numberOfLines={2}>
                  {heroItem.name}
                </Text>

                <Text style={styles.heroSynopsis} numberOfLines={3}>
                  Assista a esta superprodução em altíssima fidelidade de vídeo e áudio multicanal. Reprodução instantânea e sem travamentos.
                </Text>

                <View style={styles.heroActionsRow}>
                  <Pressable
                    focusable={true}
                    hasTVPreferredFocus={true}
                    onFocus={() => setIsHeroWatchFocused(true)}
                    onBlur={() => setIsHeroWatchFocused(false)}
                    onPress={() => setSelectedMovieForDetails(heroItem)}
                    style={[
                      styles.heroWatchBtn,
                      isHeroWatchFocused && styles.heroWatchBtnFocused,
                    ]}
                  >
                    <Ionicons name="play" size={20} color="#070A12" />
                    <Text style={styles.heroWatchBtnText}>ASSISTIR AGORA</Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onFocus={() => setIsHeroDetailsFocused(true)}
                    onBlur={() => setIsHeroDetailsFocused(false)}
                    onPress={() => setSelectedMovieForDetails(heroItem)}
                    style={[
                      styles.heroDetailsBtn,
                      isHeroDetailsFocused && styles.heroDetailsBtnFocused,
                    ]}
                  >
                    <Ionicons name="information-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.heroDetailsBtnText}>Detalhes</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Row: Categorias em Destaque (Imagem 3: Substituição da lista de streaming por categorias) */}
        {featuredCategories.length > 0 && (
          <View style={styles.sectionRow}>
            <View style={styles.sectionHeader}>
              <Ionicons name="grid-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Categorias</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryCarousel}
            >
              {featuredCategories.map((cat) => (
                <FocusablePill
                  key={`${cat.type}-${cat.id}`}
                  label={cat.name}
                  icon={cat.icon}
                  onPress={() => handleCategoryPress(cat)}
                  style={styles.categoryPill}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row: Meus Canais Favoritos (Se houver) */}
        {favoriteChannels.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>⭐ Meus Canais Favoritos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {favoriteChannels.map((channel) => (
                <FocusableCard
                  key={channel.stream_id}
                  title={channel.name}
                  imageUrl={channel.stream_icon}
                  badge="Favorito"
                  width={180}
                  aspectRatio={16 / 9}
                  onPress={() => handleOpenPlayer(channel.stream_id, 'live', channel.name)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row: Continuar Assistindo (Se houver) */}
        {continueWatching.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>▶ Continuar Assistindo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {continueWatching.map((item) => {
                const progressPct = item.durationSec > 0 ? (item.positionSec / item.durationSec) * 100 : 0;
                return (
                  <View key={item.id} style={styles.continueCardWrapper}>
                    <FocusableCard
                      title={item.title}
                      imageUrl={item.poster}
                      badge={item.type === 'movie' ? 'Filme' : item.type === 'series' ? 'Série' : 'Ao Vivo'}
                      width={140}
                      aspectRatio={2 / 3}
                      onPress={() => {
                        if (item.type === 'movie') {
                          handleMoviePress({
                            stream_id: Number(item.id),
                            name: item.title,
                            stream_icon: item.poster,
                            category_id: '',
                            container_extension: item.extension || 'mp4',
                          } as any);
                        } else {
                          handleOpenPlayer(item.id, item.type, item.title);
                        }
                      }}
                    />
                    {progressPct > 0 && (
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${Math.min(progressPct, 100)}%` }]} />
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Row: Assistir Depois (Se houver) */}
        {watchLaterList.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>🕒 Assistir Depois</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {watchLaterList.map((item) => (
                <FocusableCard
                  key={item.id}
                  title={item.title}
                  imageUrl={item.poster || item.backdrop}
                  badge={item.type === 'movie' ? 'Filme' : 'Série'}
                  rating={item.rating}
                  width={140}
                  aspectRatio={2 / 3}
                  onPress={() => {
                    if (item.type === 'movie') {
                      handleMoviePress({
                        stream_id: Number(item.id),
                        name: item.title,
                        stream_icon: item.poster || item.backdrop,
                        category_id: item.category_id || '',
                        container_extension: item.extension || 'mp4',
                      } as any);
                    } else {
                      handleOpenPlayer(item.id, item.type, item.title);
                    }
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row: Filmes Recentes (Imagem 3: abre tela de descrição/detalhes) */}
        {movies.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>🎬 Filmes em Lançamento</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {movies.map((movie) => (
                <FocusableCard
                  key={movie.stream_id}
                  title={movie.name}
                  imageUrl={movie.stream_icon}
                  rating={movie.rating_5based ? (Number(movie.rating_5based) * 2).toFixed(1) : undefined}
                  width={140}
                  aspectRatio={2 / 3}
                  onPress={() => handleMoviePress(movie)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row: Séries Populares */}
        {series.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>🍿 Séries em Destaque</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {series.map((s) => (
                <FocusableCard
                  key={s.series_id}
                  title={s.name}
                  imageUrl={s.cover}
                  rating={s.rating_5based ? (Number(s.rating_5based) * 2).toFixed(1) : undefined}
                  width={140}
                  aspectRatio={2 / 3}
                  type="series"
                  onPress={() => {
                    router.push({
                      pathname: '/(tv)/series',
                      params: { search: s.name },
                    });
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row: TV Ao Vivo em Destaque */}
        {liveChannels.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>📺 Canais Ao Vivo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {liveChannels.map((channel) => (
                <FocusableCard
                  key={channel.stream_id}
                  title={channel.name}
                  imageUrl={channel.stream_icon}
                  badge="Ao Vivo"
                  width={180}
                  aspectRatio={16 / 9}
                  onPress={() => handleOpenPlayer(channel.stream_id, 'live', channel.name)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Reusable Cinematic Movie Details Modal (Imagem 8 Standard) */}
      <TVMovieDetailsModal
        visible={!!selectedMovieForDetails}
        movie={selectedMovieForDetails}
        currentCategoryName="Filmes"
        availableCategories={availableCategories}
        onClose={() => setSelectedMovieForDetails(null)}
        onPlayMovie={handlePlayFromDetails}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A12',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070A12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 16,
    fontSize: 14,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Spotlight Hero: Novo Layout Lado a Lado (Imagem 3) */
  heroBox: {
    marginHorizontal: 24,
    marginTop: 14,
    marginBottom: 20,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0E1322',
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  heroInnerRow: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  heroPosterWrapper: {
    width: 150,
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#151C30',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: 22,
    position: 'relative',
  },
  heroPosterImg: {
    width: '100%',
    height: '100%',
  },
  heroPosterPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPosterBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.secondary, // #A855F7 (Cores do sistema)
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  heroPosterBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 9,
  },
  heroContentCol: {
    flex: 1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badgeHD: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeHDText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  heroRating: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  heroDot: {
    color: '#64748B',
  },
  heroYear: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  heroSynopsis: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    maxWidth: '90%',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroWatchBtn: {
    ...tvStyles.watchButton,
    paddingHorizontal: 20,
  },
  heroWatchBtnFocused: {
    ...tvStyles.watchButtonFocused,
    transform: [{ scale: 1.06 }],
  },
  heroWatchBtnText: {
    ...tvStyles.watchButtonText,
    fontSize: 13,
  },
  heroDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 28, 48, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  heroDetailsBtnFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
    transform: [{ scale: 1.06 }],
  },
  heroDetailsBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },

  /* Sections */
  sectionRow: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 24,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  carousel: {
    paddingHorizontal: 24,
    gap: 14,
  },
  categoryCarousel: {
    paddingHorizontal: 24,
    gap: 10,
    paddingVertical: 4,
  },
  categoryPill: {
    marginRight: 0,
  },
  continueCardWrapper: {
    position: 'relative',
  },
  progressBarBg: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 16,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
});
