import React, { useState, useEffect, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FocusableCard } from '../../src/components/tv/FocusableCard';
import { FocusablePill } from '../../src/components/tv/FocusablePill';
import { TVBackButton } from '../../src/components/tv/TVBackButton';
import { TVMovieDetailsModal } from '../../src/components/tv/TVMovieDetailsModal';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { cleanCategoryName } from '../../src/utils/categoryFormatter';
import { colors } from '../../src/theme/colors';
import { Category, VodStream } from '../../src/types/iptv';

type SortMode = 'default' | 'asc' | 'desc';

export default function TVMoviesScreen() {
  const router = useRouter();
  const { categoryId: targetCategoryId } = useLocalSearchParams<{ categoryId?: string }>();

  // Catalog State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [movies, setMovies] = useState<VodStream[]>([]);
  const [focusedMovie, setFocusedMovie] = useState<VodStream | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [isLoading, setIsLoading] = useState(true);

  // Details Modal State (Imagem 8)
  const [selectedMovieForDetails, setSelectedMovieForDetails] = useState<VodStream | null>(null);

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
        storage.getMovieFavorites().catch(() => []),
        xtreamClient.getVodCategories().catch(() => []),
      ]);

      setFavoriteIds(favIds || []);

      const allCategories: Category[] = [];
      if (favIds && favIds.length > 0) {
        allCategories.push({
          category_id: 'favorites',
          category_name: '⭐ Favoritos',
        });
      }
      allCategories.push(...cats);
      setCategories(allCategories);

      if (allCategories.length > 0) {
        let initialCat = allCategories[0];
        if (targetCategoryId) {
          const match = allCategories.find((c) => String(c.category_id) === String(targetCategoryId));
          if (match) initialCat = match;
        }
        setSelectedCategory(initialCat);
        loadMovies(initialCat.category_id, cats[0]?.category_id);
      }
    } catch (err) {
      console.error('Error loading movie categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMovies = async (categoryId: string, fallbackRealCatId?: string) => {
    try {
      let list: VodStream[] = [];
      if (categoryId === 'favorites') {
        list = await storage.getFavoriteMovies();
        if (list.length === 0 && fallbackRealCatId) {
          list = await xtreamClient.getVodStreams(fallbackRealCatId);
        }
      } else {
        list = await xtreamClient.getVodStreams(categoryId);
      }

      setMovies(list || []);
      if (list && list.length > 0) {
        setFocusedMovie(list[0]);
      } else {
        setFocusedMovie(null);
      }
    } catch (err) {
      console.error('Error loading movies:', err);
    }
  };

  const handleFocusMovie = (movie: VodStream) => {
    setFocusedMovie(movie);
  };

  // Abre a Tela de Detalhes Cinematográfica (Imagem 8) ao clicar no card
  const handleOpenDetails = (movie: VodStream) => {
    setSelectedMovieForDetails(movie);
  };

  const handleCloseDetails = () => {
    setSelectedMovieForDetails(null);
  };

  // Reproduz o filme
  const handlePlayMovie = (movie: VodStream, containerExt?: string, streamUrl?: string, startPosition?: number) => {
    handleCloseDetails();
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(movie.stream_id),
        type: 'movie',
        name: movie.name,
        container: containerExt || movie.container_extension || 'mp4',
        icon: movie.stream_icon || '',
        streamUrl: streamUrl || '',
        startPosition: startPosition ? String(startPosition) : undefined,
      },
    });
  };

  const handleToggleFavorite = async (movie: VodStream) => {
    await storage.toggleFavoriteMovie(movie);
    const updatedFavIds = await storage.getMovieFavorites();
    setFavoriteIds(updatedFavIds);

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

  // Handle Back Button: fecha modal de detalhes se estiver aberto
  useEffect(() => {
    const onBackPress = () => {
      if (selectedMovieForDetails) {
        handleCloseDetails();
        return true;
      }
      return false;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => handler.remove();
  }, [selectedMovieForDetails]);

  // Ordenação dos filmes
  const sortedMovies = useMemo(() => {
    if (sortMode === 'asc') {
      return [...movies].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    if (sortMode === 'desc') {
      return [...movies].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    }
    return movies;
  }, [movies, sortMode]);


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
      {/* ============================================================== */}
      {/* 1. TOPO: CATEGORIAS NO TOPO & BARRA SUPERIOR (IMAGEM 1 & 3)    */}
      {/* ============================================================== */}
      <View style={styles.topHeaderArea}>
        {/* Linha 1: Título da Categoria, Contagem e Filtros de Ordenação */}
        <View style={styles.categoryInfoBar}>
          <TVBackButton
            onPress={() => (router.canGoBack() ? router.back() : router.push('/(tv)/home'))}
            label=""
            style={{ marginRight: 14 }}
          />

          <View style={styles.categoryTitleGroup}>
            <Text style={styles.categoryMainTitle}>
              {selectedCategory?.category_name.toUpperCase() || 'FILMES'}
            </Text>
            <Text style={styles.categoryCountSubtitle}>
              {movies.length.toLocaleString('pt-BR')} títulos
            </Text>
          </View>

          {/* Filtros de Ordenação (Padrão, A-Z, Z-A) */}
          <View style={styles.sortFilterGroup}>
            <FocusablePill
              label="Padrão"
              variant="sort"
              isSelected={sortMode === 'default'}
              onPress={() => setSortMode('default')}
            />
            <FocusablePill
              label="A-Z"
              variant="sort"
              isSelected={sortMode === 'asc'}
              onPress={() => setSortMode('asc')}
            />
            <FocusablePill
              label="Z-A"
              variant="sort"
              isSelected={sortMode === 'desc'}
              onPress={() => setSortMode('desc')}
            />
          </View>
        </View>

        {/* Linha 2: Carrossel Horizontal de Categorias NO TOPO */}
        <View style={styles.categoriesBarWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory?.category_id === cat.category_id;
              return (
                <FocusablePill
                  key={cat.category_id}
                  label={cat.category_id === 'favorites' ? cat.category_name : cleanCategoryName(cat.category_name, 'movie')}
                  variant="category"
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
      </View>

      {/* ============================================================== */}
      {/* 2. GRADE (GRID) DE PÔSTERES COM ROLAGEM VERTICAL               */}
      {/* ============================================================== */}
      <View style={styles.gridWrapper}>
        <FlatList
          data={sortedMovies}
          keyExtractor={(item) => String(item.stream_id)}
          numColumns={6}
          showsVerticalScrollIndicator={false}
          initialNumToRender={18}
          maxToRenderPerBatch={24}
          windowSize={9}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const isFav = favoriteIds.includes(item.stream_id);
            return (
              <FocusableCard
                title={item.name}
                imageUrl={item.stream_icon}
                type="movie"
                rating={
                  item.rating_5based
                    ? (Number(item.rating_5based) * 2).toFixed(1)
                    : undefined
                }
                width={128}
                aspectRatio={2 / 3}
                badge={isFav ? '⭐' : undefined}
                onFocus={() => handleFocusMovie(item)}
                onPress={() => handleOpenDetails(item)}
              />
            );
          }}
        />
      </View>

      {/* ============================================================== */}
      {/* 4. TELA DE DETALHES COMPLETA (PADRÃO IMAGEM 8)                 */}
      {/* ============================================================== */}
      <TVMovieDetailsModal
        visible={!!selectedMovieForDetails}
        movie={selectedMovieForDetails}
        currentCategoryName={selectedCategory?.category_name}
        availableCategories={categories}
        favoriteIds={favoriteIds}
        onClose={handleCloseDetails}
        onPlayMovie={handlePlayMovie}
        onToggleFavorite={handleToggleFavorite}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A12',
  },
  centerContainer: {
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

  /* 1. Top Header: Categorias no Topo */
  topHeaderArea: {
    paddingTop: 16,
    paddingHorizontal: 24,
    backgroundColor: '#0A0E18',
    borderBottomWidth: 1,
    borderBottomColor: '#161B2E',
  },
  categoryInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  catalogBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#151C30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  catalogBackBtnFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
    transform: [{ scale: 1.1 }],
  },
  categoryTitleGroup: {
    flex: 1,
  },
  categoryMainTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  categoryCountSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  sortFilterGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#151C30',
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  sortPillSelected: {
    backgroundColor: colors.primary, // #00E5FF (Cores do sistema)
    borderColor: colors.primary,
  },
  sortPillFocused: {
    borderColor: colors.focusRing,
    transform: [{ scale: 1.05 }],
  },
  sortPillText: {
    color: '#A0A0A5',
    fontSize: 11,
    fontWeight: '700',
  },
  sortPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  categoriesBarWrapper: {
    marginBottom: 12,
  },
  categoryScrollContent: {
    alignItems: 'center',
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#151C30',
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  catPillSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
  },
  catPillFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(0, 229, 255, 0.3)',
    transform: [{ scale: 1.05 }],
  },
  catPillText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
  },
  catPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  /* 2. Grid de Filmes */
  gridWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  gridContent: {
    paddingBottom: 32,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
});
