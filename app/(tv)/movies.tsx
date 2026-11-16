import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Modal,
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
import { Category, VodStream, VodMovie } from '../../src/types/iptv';

export default function TVMoviesScreen() {
  const router = useRouter();

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [movies, setMovies] = useState<VodStream[]>([]);
  const [focusedMovie, setFocusedMovie] = useState<VodStream | null>(null);
  const [movieDetails, setMovieDetails] = useState<any | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    loadMovieCategories();
  }, []);

  const loadMovieCategories = async () => {
    try {
      setIsLoading(true);
      const profile = await storage.getActiveProfile();
      if (!profile) return;
      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

      const [favIds, cats] = await Promise.all([
        storage.getMovieFavorites(),
        xtreamClient.getVodCategories(),
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
        loadMovies(allCategories[0].category_id);
      }
    } catch (err) {
      console.error('Error loading movie categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMovies = async (categoryId: string) => {
    try {
      let list: VodStream[] = [];
      if (categoryId === 'favorites') {
        list = await storage.getFavoriteMovies();
      } else {
        list = await xtreamClient.getVodStreams(categoryId);
      }

      setMovies(list);
      if (list.length > 0) {
        handleFocusMovie(list[0]);
      } else {
        setFocusedMovie(null);
        setMovieDetails(null);
      }
    } catch (err) {
      console.error('Error loading movies:', err);
    }
  };

  const handleFocusMovie = (movie: VodStream) => {
    setFocusedMovie(movie);

    // Debounced fetch of extra VOD info to avoid hammering API during fast D-Pad navigation
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const info = await xtreamClient.getVodInfo(movie.stream_id);
        setMovieDetails(info);
      } catch {
        setMovieDetails(null);
      }
    }, 400);
  };

  const handlePlayMovie = (movie: VodStream) => {
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(movie.stream_id),
        type: 'movie',
        name: movie.name,
        container: movie.container_extension || 'mp4',
      },
    });
  };

  const handleToggleFavorite = async (movie: VodStream) => {
    const isFav = await storage.toggleFavoriteMovie(movie);
    const updatedFavIds = await storage.getMovieFavorites();
    setFavoriteIds(updatedFavIds);

    // If on favorites tab and item removed, refresh list
    if (selectedCategory?.category_id === 'favorites') {
      const updatedFavs = await storage.getFavoriteMovies();
      setMovies(updatedFavs);
      if (updatedFavs.length > 0) {
        handleFocusMovie(updatedFavs[0]);
      } else {
        setFocusedMovie(null);
      }
    }
  };

  // Back Button Handling
  useEffect(() => {
    const onBackPress = () => {
      if (showDetailsModal) {
        setShowDetailsModal(false);
        return true;
      }
      return false;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => handler.remove();
  }, [showDetailsModal]);

  const isCurrentFav = focusedMovie ? favoriteIds.includes(focusedMovie.stream_id) : false;
  const movieInfoData = movieDetails?.info;
  const movieBackdrop =
    movieInfoData?.backdrop_path?.[0] ||
    movieInfoData?.movie_image ||
    focusedMovie?.stream_icon;
  const moviePlot =
    movieInfoData?.plot ||
    movieInfoData?.description ||
    'Filme em alta definição com áudio multicanal e reprodução instantânea.';
  const movieDuration = movieInfoData?.duration || movieInfoData?.episode_run_time;
  const movieYear = movieInfoData?.releasedate?.slice(0, 4) || 'VOD';

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando Catálogo de Filmes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Top Section: Cinema Dynamic Backdrop & Movie Info */}
      <View style={styles.previewHeader}>
        {movieBackdrop ? (
          <Image
            source={{ uri: movieBackdrop }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
        ) : null}

        {/* Cinematic Vignettes */}
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
            {selectedCategory?.category_name.toUpperCase() || 'FILMES'}
          </Text>

          <Text style={styles.previewTitle} numberOfLines={2}>
            {focusedMovie?.name || 'Selecione um título'}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.badgeHD}>
              <Text style={styles.badgeHDText}>4K UHD</Text>
            </View>
            <Text style={styles.ratingText}>
              ⭐{' '}
              {movieInfoData?.rating ||
                (focusedMovie?.rating_5based
                  ? (Number(focusedMovie.rating_5based) * 2).toFixed(1)
                  : '8.4')}
            </Text>
            <Text style={styles.yearText}>• {movieYear}</Text>
            {movieDuration ? (
              <Text style={styles.durationText}>• {movieDuration}</Text>
            ) : null}
            {movieInfoData?.genre ? (
              <Text style={styles.genreText} numberOfLines={1}>
                • {movieInfoData.genre}
              </Text>
            ) : null}
          </View>

          <Text style={styles.synopsisText} numberOfLines={3}>
            {moviePlot}
          </Text>

          {/* Action Buttons with D-Pad focus */}
          {focusedMovie && (
            <View style={styles.actionRow}>
              <FocusableButton
                label="ASSISTIR AGORA"
                icon="play"
                variant="primary"
                onPress={() => handlePlayMovie(focusedMovie)}
                style={styles.actionBtn}
              />

              <FocusableButton
                label={isCurrentFav ? 'FAVORITADO' : 'FAVORITAR'}
                icon={isCurrentFav ? 'star' : 'star-outline'}
                variant="secondary"
                onPress={() => handleToggleFavorite(focusedMovie)}
                style={styles.actionBtn}
              />

              <FocusableButton
                label="DETALHES"
                icon="information-circle-outline"
                variant="secondary"
                onPress={() => setShowDetailsModal(true)}
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
              <CategoryPill
                key={cat.category_id}
                title={cat.category_name}
                isSelected={isSelected}
                onPress={() => {
                  setSelectedCategory(cat);
                  loadMovies(cat.category_id);
                }}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Horizontal Carousel of Movie Posters */}
      <View style={styles.moviesGrid}>
        <FlatList
          horizontal
          data={movies}
          keyExtractor={(item) => String(item.stream_id)}
          showsHorizontalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={15}
          windowSize={7}
          contentContainerStyle={styles.moviesScroll}
          renderItem={({ item }) => {
            const isFav = favoriteIds.includes(item.stream_id);
            return (
              <FocusableCard
                title={item.name}
                imageUrl={item.stream_icon}
                rating={
                  item.rating_5based
                    ? (Number(item.rating_5based) * 2).toFixed(1)
                    : undefined
                }
                width={135}
                aspectRatio={2 / 3}
                badge={isFav ? '⭐' : undefined}
                onFocus={() => handleFocusMovie(item)}
                onPress={() => handlePlayMovie(item)}
              />
            );
          }}
        />
      </View>

      {/* 4. Movie Details Modal (Sinopse Completa, Elenco, Diretor) */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalTitle}>{focusedMovie?.name}</Text>
                <Text style={styles.modalSub}>{movieYear} • {movieInfoData?.genre || 'Cinema'}</Text>
              </View>
              <ModalCloseButton onPress={() => setShowDetailsModal(false)} />
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalSectionTitle}>Sinopse</Text>
              <Text style={styles.modalPlot}>{moviePlot}</Text>

              {movieInfoData?.director ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Direção:</Text>
                  <Text style={styles.infoValue}>{movieInfoData.director}</Text>
                </View>
              ) : null}

              {movieInfoData?.cast ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Elenco:</Text>
                  <Text style={styles.infoValue}>{movieInfoData.cast}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <FocusableButton
                label="ASSISTIR AGORA"
                icon="play"
                hasTVPreferredFocus={true}
                onPress={() => {
                  setShowDetailsModal(false);
                  if (focusedMovie) handlePlayMovie(focusedMovie);
                }}
              />
              <FocusableButton
                label="FECHAR (VOLTAR)"
                icon="arrow-back"
                variant="secondary"
                onPress={() => setShowDetailsModal(false)}
                style={{ marginLeft: 12 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ModalCloseButton({ onPress }: { onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.modalCloseBtn, isFocused && styles.modalBtnFocused]}
    >
      <Ionicons name="close" size={20} color="#FFF" />
    </Pressable>
  );
}

function CategoryPill({
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
  durationText: {
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
  moviesGrid: {
    flex: 1,
    paddingVertical: 14,
  },
  moviesScroll: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },

  // Modal Detalhes
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalCard: {
    width: '65%',
    maxHeight: '85%',
    backgroundColor: '#121218',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#282834',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E26',
    paddingBottom: 14,
    marginBottom: 12,
  },
  modalTitleBlock: {
    flex: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSub: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 4,
  },
  modalCloseBtn: {
    backgroundColor: '#202028',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modalBtnFocused: {
    borderColor: colors.focusRing,
    backgroundColor: colors.focusRing,
  },
  modalBody: {
    marginVertical: 10,
  },
  modalSectionTitle: {
    color: colors.primaryAmber,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  modalPlot: {
    color: '#C0C0C8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#8E8E93',
    fontSize: 12,
    width: 70,
    fontWeight: 'bold',
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 12,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1E1E26',
    paddingTop: 16,
    marginTop: 10,
  },
});
