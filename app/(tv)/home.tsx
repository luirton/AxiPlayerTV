import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { TVHeader } from '../../src/components/tv/TVHeader';
import { FocusableCard } from '../../src/components/tv/FocusableCard';
import { FocusableButton } from '../../src/components/tv/FocusableButton';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';
import { LiveStream, VodStream, SeriesStream } from '../../src/types/iptv';

export default function TVHomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [liveChannels, setLiveChannels] = useState<LiveStream[]>([]);
  const [movies, setMovies] = useState<VodStream[]>([]);
  const [series, setSeries] = useState<SeriesStream[]>([]);
  const [heroItem, setHeroItem] = useState<any>(null);

  useEffect(() => {
    loadHomeData();
  }, []);

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

      // Fetch sample live channels, movies and series concurrently
      const [liveRes, vodRes, seriesRes] = await Promise.all([
        xtreamClient.getLiveStreams().catch(() => []),
        xtreamClient.getVodStreams().catch(() => []),
        xtreamClient.getSeries().catch(() => []),
      ]);

      const topLive = liveRes.slice(0, 15);
      const topMovies = vodRes.slice(0, 15);
      const topSeries = seriesRes.slice(0, 15);

      setLiveChannels(topLive);
      setMovies(topMovies);
      setSeries(topSeries);

      // Set hero spotlight
      if (topMovies.length > 0) {
        setHeroItem({
          title: topMovies[0].name,
          rating: topMovies[0].rating_5based ? (Number(topMovies[0].rating_5based) * 2).toFixed(1) : '8.4',
          backdrop: topMovies[0].stream_icon,
          id: topMovies[0].stream_id,
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
    } catch (err) {
      console.error('Error loading home data:', err);
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
              colors={['transparent', 'rgba(5, 5, 5, 0.85)', '#050505']}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(5, 5, 5, 0.9)', 'rgba(5, 5, 5, 0.4)', 'transparent']}
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

        {/* Row 1: TV Ao Vivo */}
        {liveChannels.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>📺 Canais em Destaque</Text>
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

        {/* Row 2: Filmes */}
        {movies.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>🎬 Filmes Recentes</Text>
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

        {/* Row 3: Séries */}
        {series.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>🍿 Séries Populares</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  loadingContainer: {
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
    backgroundColor: '#121216',
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 10,
  },
  badgeHDText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  heroRating: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 10,
  },
  heroYear: {
    color: '#8E8E93',
    fontSize: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroSynopsis: {
    color: '#B0B0B5',
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
});
