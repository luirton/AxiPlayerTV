import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FocusableCard } from '../../src/components/tv/FocusableCard';
import { FocusableButton } from '../../src/components/tv/FocusableButton';
import { EnrichedPosterImage } from '../../src/components/common/EnrichedPosterImage';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { enrichMediaMetadata, EnrichedMetadata } from '../../src/services/metadataEnricher';
import { colors } from '../../src/theme/colors';
import { Category, VodStream } from '../../src/types/iptv';

type SortMode = 'default' | 'asc' | 'desc';

export default function TVMoviesScreen() {
  const router = useRouter();

  // Catalog State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [movies, setMovies] = useState<VodStream[]>([]);
  const [focusedMovie, setFocusedMovie] = useState<VodStream | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [isLoading, setIsLoading] = useState(true);

  // Compact Preview State (topo)
  const [previewMeta, setPreviewMeta] = useState<EnrichedMetadata | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // Details Modal State (Imagem 4)
  const [selectedMovieForDetails, setSelectedMovieForDetails] = useState<VodStream | null>(null);
  const [detailsInfo, setDetailsInfo] = useState<any | null>(null);
  const [detailsMeta, setDetailsMeta] = useState<EnrichedMetadata | null>(null);
  const [isInMyList, setIsInMyList] = useState<boolean>(false);
  const [isInWatchLater, setIsInWatchLater] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

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
        const initialCat = allCategories[0];
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
        handleFocusMovie(list[0]);
      } else {
        setFocusedMovie(null);
        setPreviewMeta(null);
      }
    } catch (err) {
      console.error('Error loading movies:', err);
    }
  };

  const handleFocusMovie = (movie: VodStream) => {
    setFocusedMovie(movie);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const meta = await enrichMediaMetadata(movie.name, 'movie');
        setPreviewMeta(meta);
      } catch {
        setPreviewMeta(null);
      }
    }, 280);
  };

  // Abre a Tela de Detalhes Cinematográfica (Imagem 4) ao clicar no card
  const handleOpenDetails = async (movie: VodStream) => {
    setSelectedMovieForDetails(movie);
    setIsLoadingDetails(true);

    try {
      const [info, meta, inList, inLater] = await Promise.all([
        xtreamClient.getVodInfo(movie.stream_id).catch(() => null),
        enrichMediaMetadata(movie.name, 'movie').catch(() => null),
        storage.isInMyList(movie.stream_id).catch(() => false),
        storage.isInWatchLater(movie.stream_id).catch(() => false),
      ]);
      setDetailsInfo(info);
      setDetailsMeta(meta);
      setIsInMyList(inList);
      setIsInWatchLater(inLater);
    } catch (e) {
      console.warn('Erro ao carregar detalhes do filme:', e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setSelectedMovieForDetails(null);
    setDetailsInfo(null);
    setDetailsMeta(null);
  };

  // Reproduz o filme diretamente
  const handlePlayMovie = (movie: VodStream) => {
    handleCloseDetails();
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(movie.stream_id),
        type: 'movie',
        name: movie.name,
        container: detailsInfo?.movie_data?.container_extension || movie.container_extension || 'mp4',
        icon: movie.stream_icon || detailsMeta?.poster || '',
      },
    });
  };

  // Ações de Minha Lista, Assistir Depois e Favoritos
  const handleToggleMyList = async (movie: VodStream) => {
    const inList = await storage.toggleMyList({
      id: movie.stream_id,
      title: movie.name,
      poster: movie.stream_icon || detailsMeta?.poster || undefined,
      backdrop: detailsBackdrop || undefined,
      type: 'movie',
      category_id: selectedCategory?.category_id,
      category_name: selectedCategory?.category_name,
      rating: String(detailsRating),
      year: String(detailsYear),
      genre: detailsGenre || undefined,
      plot: detailsPlot || undefined,
      addedAt: Date.now(),
    });
    setIsInMyList(inList);
  };

  const handleToggleWatchLater = async (movie: VodStream) => {
    const inLater = await storage.toggleWatchLater({
      id: movie.stream_id,
      title: movie.name,
      poster: movie.stream_icon || detailsMeta?.poster || undefined,
      backdrop: detailsBackdrop || undefined,
      type: 'movie',
      category_id: selectedCategory?.category_id,
      category_name: selectedCategory?.category_name,
      rating: String(detailsRating),
      year: String(detailsYear),
      genre: detailsGenre || undefined,
      plot: detailsPlot || undefined,
      addedAt: Date.now(),
    });
    setIsInWatchLater(inLater);
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

  // Metadados do Compact Preview (topo do catálogo)
  const previewRating =
    previewMeta?.rating ||
    (focusedMovie?.rating_5based ? (Number(focusedMovie.rating_5based) * 2).toFixed(1) : '8.4');
  const previewYear = previewMeta?.year || '2025';
  const previewBackdrop =
    previewMeta?.backdrop ||
    previewMeta?.poster ||
    focusedMovie?.stream_icon;
  const previewPlot =
    previewMeta?.plot ||
    'Filme em alta definição com áudio multicanal e reprodução instantânea.';

  // Metadados da Tela de Detalhes (Imagem 4)
  const detailsMovieInfo = detailsInfo?.info;
  const detailsRating =
    detailsMovieInfo?.rating ||
    detailsMeta?.rating ||
    (selectedMovieForDetails?.rating_5based
      ? (Number(selectedMovieForDetails.rating_5based) * 2).toFixed(1)
      : '8.5');
  const detailsYear =
    detailsMovieInfo?.releasedate?.slice(0, 4) ||
    detailsMeta?.year ||
    '2026';
  const detailsGenre = detailsMovieInfo?.genre || detailsMeta?.genre || selectedCategory?.category_name || 'Filmes';
  const detailsDuration = detailsMovieInfo?.duration || detailsMovieInfo?.episode_run_time || '1h 45m';
  const detailsPlot =
    detailsMovieInfo?.plot ||
    detailsMeta?.plot ||
    detailsMovieInfo?.description ||
    `Acompanhe a história eletrizante de "${selectedMovieForDetails?.name}". Uma superprodução com áudio e imagem em alta fidelidade.`;
  const detailsBackdrop =
    detailsMovieInfo?.backdrop_path?.[0] ||
    detailsMeta?.backdrop ||
    detailsMovieInfo?.movie_image ||
    selectedMovieForDetails?.stream_icon;

  // Filmes Relacionados ("Você também pode gostar")
  const relatedMovies = useMemo(() => {
    if (!selectedMovieForDetails) return [];
    return movies
      .filter((m) => m.stream_id !== selectedMovieForDetails.stream_id)
      .slice(0, 14);
  }, [movies, selectedMovieForDetails]);

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
          <Pressable
            focusable={true}
            onPress={() => (router.canGoBack() ? router.back() : router.push('/(tv)/home'))}
            style={({ focused }: any) => [
              styles.catalogBackBtn,
              focused && styles.catalogBackBtnFocused,
            ]}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>

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
            <SortPill
              label="Padrão"
              isSelected={sortMode === 'default'}
              onPress={() => setSortMode('default')}
            />
            <SortPill
              label="A-Z"
              isSelected={sortMode === 'asc'}
              onPress={() => setSortMode('asc')}
            />
            <SortPill
              label="Z-A"
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
      </View>

      {/* ============================================================== */}
      {/* 2. PREVIEW COMPACTO DO ITEM FOCADO (IMAGEM 3)                  */}
      {/* ============================================================== */}
      {focusedMovie ? (
        <View style={styles.compactPreviewContainer}>
          {previewBackdrop ? (
            <Image
              source={{ uri: previewBackdrop }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : null}
          <LinearGradient
            colors={['rgba(7, 10, 18, 0.75)', 'rgba(7, 10, 18, 0.95)', '#070A12']}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(7, 10, 18, 0.98)', 'rgba(7, 10, 18, 0.7)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.compactPreviewContent}>
            <Text style={styles.previewMovieTitle} numberOfLines={1}>
              {focusedMovie.name}
            </Text>

            <View style={styles.previewMetaRow}>
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>FILME</Text>
              </View>
              <Text style={styles.previewRatingText}>★ {previewRating}</Text>
              <Text style={styles.previewMetaDot}>•</Text>
              <Text style={styles.previewMetaText}>{previewYear}</Text>
              <Text style={styles.previewMetaDot}>•</Text>
              <Text style={styles.previewMetaText}>4K UHD</Text>
            </View>

            <Text style={styles.previewSynopsisText} numberOfLines={2}>
              {previewPlot}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ============================================================== */}
      {/* 3. GRADE (GRID) DE PÔSTERES COM ROLAGEM VERTICAL (IMAGEM 3)    */}
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
      {/* 4. TELA DE DETALHES COMPLETA (PADRÃO IMAGEM 4)                 */}
      {/* ============================================================== */}
      <Modal
        visible={!!selectedMovieForDetails}
        transparent={false}
        animationType="fade"
        onRequestClose={handleCloseDetails}
      >
        <View style={styles.detailsScreenContainer}>
          {/* Top Bar com Botão Voltar */}
          <View style={styles.detailsTopBar}>
            <Pressable
              focusable={true}
              onPress={handleCloseDetails}
              style={({ focused }: any) => [
                styles.detailsBackCircleBtn,
                focused && styles.detailsBackCircleBtnFocused,
              ]}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.detailsTopBarTitle} numberOfLines={1}>
              {selectedMovieForDetails?.name}
            </Text>
          </View>

          <ScrollView
            style={styles.detailsScrollView}
            contentContainerStyle={styles.detailsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Backdrop Imersivo Superior com Degradê */}
            <View style={styles.detailsHeroBackdrop}>
              {detailsBackdrop ? (
                <Image
                  source={{ uri: detailsBackdrop }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : null}

              <LinearGradient
                colors={['transparent', 'rgba(7, 10, 18, 0.7)', '#070A12']}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(7, 10, 18, 0.85)', 'rgba(7, 10, 18, 0.3)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Informações Principais do Filme */}
              <View style={styles.detailsHeroInfo}>
                <Text style={styles.detailsMainTitle}>
                  {selectedMovieForDetails?.name}
                </Text>

                <View style={styles.detailsMetaRow}>
                  <Text style={styles.detailsMetaText}>{detailsYear}</Text>
                  <Text style={styles.detailsMetaDot}>•</Text>
                  <Text style={styles.detailsMetaText}>{detailsGenre}</Text>
                  <Text style={styles.detailsMetaDot}>•</Text>
                  <Text style={styles.detailsMetaText}>{detailsDuration}</Text>
                  <Text style={styles.detailsMetaDot}>•</Text>
                  <Text style={styles.detailsMetaRating}>⭐ {detailsRating}</Text>
                </View>

                {/* BOTÃO PRINCIPAL NEON: ASSISTIR (Largo, Destaque com Foco Automático) */}
                <Pressable
                  focusable={true}
                  hasTVPreferredFocus={true}
                  onPress={() => selectedMovieForDetails && handlePlayMovie(selectedMovieForDetails)}
                  style={({ focused }: any) => [
                    styles.primaryWatchButton,
                    focused && styles.primaryWatchButtonFocused,
                  ]}
                >
                  <LinearGradient
                    colors={['#00E5FF', '#A855F7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryWatchGradient}
                  >
                    <Ionicons name="play" size={24} color="#000000" />
                    <Text style={styles.primaryWatchText}>Assistir</Text>
                  </LinearGradient>
                </Pressable>

                {/* Sinopse Completa */}
                <Text style={styles.detailsPlotText}>
                  {detailsPlot}
                </Text>

                {/* Linha de Botões de Ação Rápidos (Minha Lista, Assistir Depois, Favoritar) */}
                <View style={styles.detailsActionRow}>
                  <Pressable
                    focusable={true}
                    onPress={() => selectedMovieForDetails && handleToggleMyList(selectedMovieForDetails)}
                    style={({ focused }: any) => [
                      styles.actionIconBtn,
                      focused && styles.actionIconBtnFocused,
                    ]}
                  >
                    <Ionicons
                      name={isInMyList ? 'checkmark' : 'add'}
                      size={24}
                      color={isInMyList ? colors.primary : '#FFFFFF'}
                    />
                    <Text style={[styles.actionBtnText, isInMyList && { color: colors.primary }]}>
                      {isInMyList ? 'Na lista' : 'Minha lista'}
                    </Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => selectedMovieForDetails && handleToggleWatchLater(selectedMovieForDetails)}
                    style={({ focused }: any) => [
                      styles.actionIconBtn,
                      focused && styles.actionIconBtnFocused,
                    ]}
                  >
                    <Ionicons
                      name={isInWatchLater ? 'time' : 'time-outline'}
                      size={24}
                      color={isInWatchLater ? colors.primary : '#FFFFFF'}
                    />
                    <Text style={[styles.actionBtnText, isInWatchLater && { color: colors.primary }]}>
                      {isInWatchLater ? 'Salvo' : 'Assistir depois'}
                    </Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => selectedMovieForDetails && handleToggleFavorite(selectedMovieForDetails)}
                    style={({ focused }: any) => [
                      styles.actionIconBtn,
                      focused && styles.actionIconBtnFocused,
                    ]}
                  >
                    <Ionicons
                      name={
                        selectedMovieForDetails && favoriteIds.includes(selectedMovieForDetails.stream_id)
                          ? 'star'
                          : 'star-outline'
                      }
                      size={24}
                      color={
                        selectedMovieForDetails && favoriteIds.includes(selectedMovieForDetails.stream_id)
                          ? '#FFD700'
                          : '#FFFFFF'
                      }
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        selectedMovieForDetails &&
                          favoriteIds.includes(selectedMovieForDetails.stream_id) && {
                            color: '#FFD700',
                          },
                      ]}
                    >
                      Favoritar
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Seção "Você também pode gostar" (Carrossel Horizontal de Recomendados) */}
            {relatedMovies.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={styles.relatedSectionTitle}>Você também pode gostar</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.relatedCarousel}
                >
                  {relatedMovies.map((item) => (
                    <FocusableCard
                      key={item.stream_id}
                      title={item.name}
                      imageUrl={item.stream_icon}
                      type="movie"
                      width={130}
                      aspectRatio={2 / 3}
                      onPress={() => handleOpenDetails(item)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// Item Pill de Categoria no Topo
function CategoryPill({
  title,
  isSelected,
  onPress,
}: {
  title: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      focusable={true}
      onPress={onPress}
      style={({ focused }: any) => [
        styles.catPill,
        isSelected && styles.catPillSelected,
        focused && styles.catPillFocused,
      ]}
    >
      <Text
        style={[
          styles.catPillText,
          isSelected && styles.catPillTextSelected,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// Item Pill de Ordenação (Padrão, A-Z, Z-A)
function SortPill({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      focusable={true}
      onPress={onPress}
      style={({ focused }: any) => [
        styles.sortPill,
        isSelected && styles.sortPillSelected,
        focused && styles.sortPillFocused,
      ]}
    >
      <Text style={[styles.sortPillText, isSelected && styles.sortPillTextSelected]}>
        {label}
      </Text>
    </Pressable>
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
    backgroundColor: '#FF6A00',
    borderColor: '#FF8A00',
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

  /* 2. Compact Preview: Item focado na grade */
  compactPreviewContainer: {
    height: 115,
    backgroundColor: '#0E1322',
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#161B2E',
  },
  compactPreviewContent: {
    maxWidth: '75%',
    zIndex: 2,
  },
  previewMovieTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  previewBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewBadgeText: {
    color: '#070A12',
    fontSize: 9,
    fontWeight: '900',
  },
  previewRatingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  previewMetaDot: {
    color: '#555',
    fontSize: 11,
  },
  previewMetaText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  previewSynopsisText: {
    color: '#A0A0A5',
    fontSize: 12,
    lineHeight: 16,
  },

  /* 3. Grid de Filmes */
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

  /* 4. Tela de Detalhes Completa (Imagem 4) */
  detailsScreenContainer: {
    flex: 1,
    backgroundColor: '#070A12',
  },
  detailsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: 'rgba(7, 10, 18, 0.95)',
    zIndex: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#161B2E',
  },
  detailsBackCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2845',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  detailsBackCircleBtnFocused: {
    borderColor: colors.focusRing,
    transform: [{ scale: 1.1 }],
  },
  detailsTopBarTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    flex: 1,
  },
  detailsScrollView: {
    flex: 1,
  },
  detailsScrollContent: {
    paddingBottom: 60,
  },
  detailsHeroBackdrop: {
    minHeight: 460,
    position: 'relative',
    justifyContent: 'flex-end',
    paddingHorizontal: 36,
    paddingBottom: 32,
    backgroundColor: '#0A0E18',
  },
  detailsHeroInfo: {
    maxWidth: '85%',
    zIndex: 5,
  },
  detailsMainTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  detailsMetaText: {
    color: '#9AA4BC',
    fontSize: 14,
    fontWeight: '600',
  },
  detailsMetaDot: {
    color: '#555',
    fontSize: 14,
  },
  detailsMetaRating: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryWatchButton: {
    width: '100%',
    maxWidth: 580,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  primaryWatchButtonFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.03 }],
    elevation: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
  },
  primaryWatchGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryWatchText: {
    color: '#070A12',
    fontSize: 18,
    fontWeight: '900',
  },
  detailsPlotText: {
    color: '#C5C9D6',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 700,
  },
  detailsActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
    marginTop: 6,
  },
  actionIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  actionIconBtnFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    transform: [{ scale: 1.08 }],
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Seção "Você também pode gostar" */
  relatedSection: {
    marginTop: 32,
    paddingHorizontal: 36,
  },
  relatedSectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 16,
  },
  relatedCarousel: {
    gap: 14,
    paddingBottom: 20,
  },
});
