import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TVHeader } from '../../src/components/tv/TVHeader';
import { FocusableCard } from '../../src/components/tv/FocusableCard';
import { FocusableButton } from '../../src/components/tv/FocusableButton';
import { StreamingBrandsRow, StreamingBrand } from '../../src/components/home/StreamingBrands';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage, WatchProgressItem, MediaListItem } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';
import { LiveStream, VodStream, SeriesStream, LiveChannel } from '../../src/types/iptv';

export default function TVHomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [liveChannels, setLiveChannels] = useState<LiveStream[]>([]);
  const [movies, setMovies] = useState<VodStream[]>([]);
  const [series, setSeries] = useState<SeriesStream[]>([]);
  const [heroItem, setHeroItem] = useState<any>(null);

  // Collections state
  const [favoriteChannels, setFavoriteChannels] = useState<LiveChannel[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchProgressItem[]>([]);
  const [watchLaterList, setWatchLaterList] = useState<MediaListItem[]>([]);

  // Brand Modal State
  const [selectedBrand, setSelectedBrand] = useState<StreamingBrand | null>(null);
  const [brandModalVisible, setBrandModalVisible] = useState(false);

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

      const firstVodCatId =
        vodCatsRes && Array.isArray(vodCatsRes) && vodCatsRes.length > 0
          ? vodCatsRes[0].category_id
          : undefined;

      const firstSeriesCatId =
        seriesCatsRes && Array.isArray(seriesCatsRes) && seriesCatsRes.length > 0
          ? seriesCatsRes[0].category_id
          : undefined;

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

      // Spotlight Hero item com metadados enriquecidos
      if (topMovies.length > 0) {
        const poolSize = Math.min(topMovies.length, 10);
        const randomIdx = Math.floor(Math.random() * poolSize);
        const hero = topMovies[randomIdx] || topMovies[0];

        setHeroItem({
          title: hero.name,
          rating: hero.rating_5based ? (Number(hero.rating_5based) * 2).toFixed(1) : '8.5',
          backdrop: hero.stream_icon,
          id: hero.stream_id,
          type: 'movie',
        });
      } else if (topLive.length > 0) {
        setHeroItem({
          title: topLive[0].name,
          rating: 'Ao Vivo',
          backdrop: topLive[0].stream_icon,
          id: topLive[0].stream_id,
          type: 'live',
        });
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

  const handleSelectBrand = (brand: StreamingBrand) => {
    setSelectedBrand(brand);
    setBrandModalVisible(true);
  };

  const navigateToBrandContent = (type: 'movies' | 'series') => {
    if (!selectedBrand) return;
    setBrandModalVisible(false);

    if (type === 'movies') {
      router.push({
        pathname: '/(tv)/movies',
        params: { search: selectedBrand.name },
      });
    } else {
      router.push({
        pathname: '/(tv)/series',
        params: { search: selectedBrand.name },
      });
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

  return (
    <View style={styles.container}>
      <TVHeader title="Axi Player TV" subtitle="Início & Lançamentos" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Spotlight Hero Banner (16:9 Cinema Aspect) */}
        {heroItem && (
          <View style={styles.heroContainer}>
            {heroItem.backdrop ? (
              <Image
                source={{ uri: heroItem.backdrop }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : null}
            <LinearGradient
              colors={['transparent', 'rgba(7, 10, 18, 0.85)', '#070A12']}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(7, 10, 18, 0.95)', 'rgba(7, 10, 18, 0.5)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.heroDetails}>
              <View style={styles.heroBadgeRow}>
                <View style={styles.badgeHD}>
                  <Text style={styles.badgeHDText}>4K UHD</Text>
                </View>
                <Text style={styles.heroRating}>⭐ {heroItem.rating}</Text>
                <Text style={styles.heroYear}>2025</Text>
              </View>

              <Text style={styles.heroTitle} numberOfLines={2}>
                {heroItem.title}
              </Text>
              <Text style={styles.heroSynopsis} numberOfLines={2}>
                Assista em altíssima definição sem travamentos, com áudio multicanal e suporte a legendas sincronizadas.
              </Text>

              <View style={styles.heroActions}>
                <FocusableButton
                  label="ASSISTIR AGORA"
                  icon="play"
                  onPress={() => handleOpenPlayer(heroItem.id, heroItem.type, heroItem.title)}
                  hasTVPreferredFocus={true}
                />
              </View>
            </View>
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
                      onPress={() => handleOpenPlayer(item.id, item.type, item.title)}
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
                  onPress={() => handleOpenPlayer(item.id, item.type, item.title)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row: Marcas de Streaming */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>⚡ Plataformas de Streaming</Text>
          <StreamingBrandsRow onSelectBrand={handleSelectBrand} />
        </View>

        {/* Row 1: TV Ao Vivo em Destaque */}
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

        {/* Row 2: Filmes Recentes */}
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
                  onPress={() => handleOpenPlayer(movie.stream_id, 'movie', movie.name)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row 3: Séries Populares */}
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
                  onPress={() => router.push({ pathname: '/(tv)/series', params: { seriesId: String(s.series_id) } })}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Brand Selection Modal */}
      <Modal
        visible={brandModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setBrandModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setBrandModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Explorar {selectedBrand?.name}
            </Text>
            <Text style={styles.modalSubtitle}>
              O que você deseja assistir desta plataforma?
            </Text>

            <View style={styles.modalActions}>
              <FocusableButton
                label="🎬 Filmes"
                icon="film-outline"
                onPress={() => navigateToBrandContent('movies')}
                style={styles.modalButton}
                hasTVPreferredFocus={true}
              />
              <FocusableButton
                label="🍿 Séries"
                icon="albums-outline"
                onPress={() => navigateToBrandContent('series')}
                style={styles.modalButton}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
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
    color: '#9AA4BC',
    marginTop: 16,
    fontSize: 14,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroContainer: {
    height: 280,
    marginHorizontal: 24,
    marginBottom: 20,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#1B2338',
  },
  heroDetails: {
    padding: 24,
    maxWidth: '65%',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeHD: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
  },
  badgeHDText: {
    color: '#070A12',
    fontSize: 10,
    fontWeight: '900',
  },
  heroRating: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 10,
  },
  heroYear: {
    color: '#9AA4BC',
    fontSize: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroSynopsis: {
    color: '#9AA4BC',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  heroActions: {
    flexDirection: 'row',
  },
  sectionRow: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 24,
    marginBottom: 12,
  },
  carousel: {
    paddingLeft: 24,
    paddingRight: 24,
  },
  continueCardWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  progressBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 440,
    backgroundColor: '#0E1322',
    borderWidth: 1.5,
    borderColor: '#1B2338',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#9AA4BC',
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  modalButton: {
    flex: 1,
  },
});
