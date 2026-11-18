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
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FocusableCard } from '../../src/components/tv/FocusableCard';
import { FocusablePill } from '../../src/components/tv/FocusablePill';
import { TVBackButton } from '../../src/components/tv/TVBackButton';
import { EnrichedPosterImage } from '../../src/components/common/EnrichedPosterImage';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage, WatchProgressItem } from '../../src/services/storage';
import { enrichMediaMetadata, EnrichedMetadata } from '../../src/services/metadataEnricher';
import { cleanCategoryName } from '../../src/utils/categoryFormatter';
import { colors } from '../../src/theme/colors';
import { tvColors, tvStyles } from '../../src/theme/tvTheme';
import {
  Category,
  SeriesStream,
  SeriesInfoResponse,
  SeriesEpisode,
} from '../../src/types/iptv';

type SortMode = 'default' | 'asc' | 'desc';

export default function TVSeriesScreen() {
  const router = useRouter();
  const { categoryId: targetCategoryId } = useLocalSearchParams<{ categoryId?: string }>();

  // Catalog State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [seriesList, setSeriesList] = useState<SeriesStream[]>([]);
  const [focusedSeries, setFocusedSeries] = useState<SeriesStream | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [isLoading, setIsLoading] = useState(true);

  // Details Modal State (Imagem 4)
  const [selectedSeriesForDetails, setSelectedSeriesForDetails] = useState<SeriesStream | null>(null);
  const [seriesDetails, setSeriesDetails] = useState<SeriesInfoResponse | null>(null);
  const [detailsMeta, setDetailsMeta] = useState<EnrichedMetadata | null>(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<string>('1');
  const [focusedEpisode, setFocusedEpisode] = useState<SeriesEpisode | null>(null);
  const [focusedActionBtn, setFocusedActionBtn] = useState<string | null>('play');
  const [isInMyList, setIsInMyList] = useState<boolean>(false);
  const [isInWatchLater, setIsInWatchLater] = useState<boolean>(false);
  const [hasEpisodeProgress, setHasEpisodeProgress] = useState<boolean>(false);
  const [savedEpisodeProgress, setSavedEpisodeProgress] = useState<WatchProgressItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const checkProgress = async () => {
      const epId = focusedEpisode?.id;
      if (epId) {
        const prog = await storage.getWatchProgress(epId).catch(() => null);
        if (isMounted) {
          setSavedEpisodeProgress(prog);
          setHasEpisodeProgress(
            !!(prog && prog.positionSec > 10 && prog.durationSec > 0 && prog.positionSec < prog.durationSec - 30)
          );
        }
      } else if (selectedSeriesForDetails) {
        const prog = await storage.getWatchProgress(selectedSeriesForDetails.series_id).catch(() => null);
        if (isMounted) {
          setSavedEpisodeProgress(prog);
          setHasEpisodeProgress(!!(prog && prog.positionSec > 10));
        }
      }
    };
    checkProgress();
    return () => {
      isMounted = false;
    };
  }, [focusedEpisode, selectedSeriesForDetails]);

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
        storage.getSeriesFavorites().catch(() => []),
        xtreamClient.getSeriesCategories().catch(() => []),
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
        loadSeries(initialCat.category_id, cats[0]?.category_id);
      }
    } catch (err) {
      console.error('Error loading series categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSeries = async (categoryId: string, fallbackRealCatId?: string) => {
    try {
      let list: SeriesStream[] = [];
      if (categoryId === 'favorites') {
        list = await storage.getFavoriteSeries();
        if (list.length === 0 && fallbackRealCatId) {
          list = await xtreamClient.getSeries(fallbackRealCatId);
        }
      } else {
        list = await xtreamClient.getSeries(categoryId);
      }

      setSeriesList(list || []);
      if (list && list.length > 0) {
        setFocusedSeries(list[0]);
      } else {
        setFocusedSeries(null);
      }
    } catch (err) {
      console.error('Error loading series:', err);
    }
  };

  const handleFocusSeries = (series: SeriesStream) => {
    setFocusedSeries(series);
  };

  // Abre a Tela de Detalhes da Série (Imagem 4) ao clicar no card
  const handleOpenDetails = async (series: SeriesStream) => {
    setSelectedSeriesForDetails(series);
    setIsLoadingDetails(true);

    try {
      const [info, meta, inList, inLater] = await Promise.all([
        xtreamClient.getSeriesInfo(series.series_id).catch(() => null),
        enrichMediaMetadata(series.name, 'series').catch(() => null),
        storage.isInMyList(series.series_id).catch(() => false),
        storage.isInWatchLater(series.series_id).catch(() => false),
      ]);
      setSeriesDetails(info);
      setDetailsMeta(meta);
      setIsInMyList(inList);
      setIsInWatchLater(inLater);

      // Temporada inicial
      const seasonKeys = info?.episodes ? Object.keys(info.episodes) : [];
      const firstSeason = seasonKeys.length > 0 ? seasonKeys[0] : '1';
      setSelectedSeasonNumber(firstSeason);

      const eps = info?.episodes?.[firstSeason] || [];
      if (eps.length > 0) {
        setFocusedEpisode(eps[0]);
      } else {
        setFocusedEpisode(null);
      }
    } catch (e) {
      console.warn('Erro ao carregar detalhes da série:', e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setSelectedSeriesForDetails(null);
    setSeriesDetails(null);
    setDetailsMeta(null);
    setFocusedEpisode(null);
  };

  // Reproduz episódio selecionado
  const handlePlayEpisode = (episode: SeriesEpisode) => {
    if (!selectedSeriesForDetails) return;
    const seriesTitle = selectedSeriesForDetails.name;
    handleCloseDetails();
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(episode.id),
        type: 'series',
        name: `${seriesTitle} • T${episode.season}E${episode.episode_num}: ${episode.title}`,
        container: episode.container_extension || 'mp4',
        icon: selectedSeriesForDetails.cover || detailsMeta?.poster || '',
        seriesId: String(selectedSeriesForDetails.series_id),
        seriesTitle: seriesTitle,
        seasonNum: String(episode.season),
        episodeNum: String(episode.episode_num),
      },
    });
  };

  // Botão principal: Assistir Último Episódio Visto ou Primeiro Episódio
  const handlePlayFirstEpisode = () => {
    if (!selectedSeriesForDetails || !seriesDetails?.episodes) return;
    // Se tiver progresso salvo do último episódio visto desta série, continua dele com o link que deu certo
    if (savedEpisodeProgress && savedEpisodeProgress.id) {
      handleCloseDetails();
      router.push({
        pathname: '/player/[id]',
        params: {
          id: String(savedEpisodeProgress.id),
          type: 'series',
          name: savedEpisodeProgress.title,
          container: savedEpisodeProgress.extension || 'mp4',
          icon: savedEpisodeProgress.poster || selectedSeriesForDetails.cover || detailsMeta?.poster || '',
          streamUrl: savedEpisodeProgress.streamUrl || '',
          startPosition: String(savedEpisodeProgress.positionSec || 0),
          seriesId: String(selectedSeriesForDetails.series_id),
          seriesTitle: selectedSeriesForDetails.name,
          seasonNum: savedEpisodeProgress.seasonNum ? String(savedEpisodeProgress.seasonNum) : undefined,
          episodeNum: savedEpisodeProgress.episodeNum ? String(savedEpisodeProgress.episodeNum) : undefined,
        },
      });
      return;
    }

    const seasonKeys = Object.keys(seriesDetails.episodes);
    const seasonKey = seasonKeys.includes(selectedSeasonNumber) ? selectedSeasonNumber : seasonKeys[0];
    const eps = seriesDetails.episodes[seasonKey] || [];
    const targetEpisode = focusedEpisode || eps[0];
    if (targetEpisode) {
      handlePlayEpisode(targetEpisode);
    }
  };

  // Ações de Minha Lista, Assistir Depois e Favoritos
  const handleToggleMyList = async (series: SeriesStream) => {
    const inList = await storage.toggleMyList({
      id: series.series_id,
      title: series.name,
      poster: series.cover || detailsMeta?.poster || undefined,
      backdrop: detailsBackdrop || undefined,
      type: 'series',
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

  const handleToggleWatchLater = async (series: SeriesStream) => {
    const inLater = await storage.toggleWatchLater({
      id: series.series_id,
      title: series.name,
      poster: series.cover || detailsMeta?.poster || undefined,
      backdrop: detailsBackdrop || undefined,
      type: 'series',
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

  const handleToggleFavorite = async (series: SeriesStream) => {
    await storage.toggleFavoriteSeries(series);
    const updatedFavIds = await storage.getSeriesFavorites();
    setFavoriteIds(updatedFavIds);

    if (selectedCategory?.category_id === 'favorites') {
      const updatedFavs = await storage.getFavoriteSeries();
      setSeriesList(updatedFavs);
      if (updatedFavs.length > 0) {
        handleFocusSeries(updatedFavs[0]);
      } else {
        setFocusedSeries(null);
      }
    }
  };

  // Handle Back Button: fecha modal de detalhes se estiver aberto
  useEffect(() => {
    const onBackPress = () => {
      if (selectedSeriesForDetails) {
        handleCloseDetails();
        return true;
      }
      return false;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => handler.remove();
  }, [selectedSeriesForDetails]);

  // Ordenação das séries
  const sortedSeries = useMemo(() => {
    if (sortMode === 'asc') {
      return [...seriesList].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    if (sortMode === 'desc') {
      return [...seriesList].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    }
    return seriesList;
  }, [seriesList, sortMode]);


  // Metadados da Tela de Detalhes (Imagem 4)
  const detailsSeriesInfo = seriesDetails?.info;
  const detailsRating =
    detailsSeriesInfo?.rating ||
    detailsMeta?.rating ||
    (selectedSeriesForDetails?.rating_5based
      ? (Number(selectedSeriesForDetails.rating_5based) * 2).toFixed(1)
      : '8.8');
  const detailsYear =
    detailsSeriesInfo?.releaseDate?.slice(0, 4) ||
    detailsMeta?.year ||
    '2026';
  const detailsGenre = detailsSeriesInfo?.genre || detailsMeta?.genre || selectedCategory?.category_name || 'Séries';
  const detailsBackdrop =
    detailsSeriesInfo?.backdrop_path?.[0] ||
    detailsMeta?.backdrop ||
    detailsSeriesInfo?.cover ||
    selectedSeriesForDetails?.cover;
  const seasonKeys = seriesDetails?.episodes ? Object.keys(seriesDetails.episodes) : [];
  const currentEpisodes = seriesDetails?.episodes?.[selectedSeasonNumber] || [];
  const detailsPlot =
    detailsSeriesInfo?.plot ||
    detailsMeta?.plot ||
    `Acompanhe a história eletrizante de "${selectedSeriesForDetails?.name}". Uma superprodução com áudio e imagem em alta fidelidade.`;

  // Séries Relacionadas ("Você também pode gostar")
  const relatedSeries = useMemo(() => {
    if (!selectedSeriesForDetails) return [];
    return seriesList
      .filter((s) => s.series_id !== selectedSeriesForDetails.series_id)
      .slice(0, 14);
  }, [seriesList, selectedSeriesForDetails]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando Catálogo de Séries...</Text>
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
              {selectedCategory?.category_id === 'favorites'
                ? selectedCategory.category_name.toUpperCase()
                : cleanCategoryName(selectedCategory?.category_name || '', 'series').toUpperCase() || 'SÉRIES'}
            </Text>
            <Text style={styles.categoryCountSubtitle}>
              {seriesList.length.toLocaleString('pt-BR')} títulos
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
                  label={cat.category_id === 'favorites' ? cat.category_name : cleanCategoryName(cat.category_name, 'series')}
                  variant="category"
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
      </View>

      {/* ============================================================== */}
      {/* 2. GRADE (GRID) DE SÉRIES COM ROLAGEM VERTICAL                 */}
      {/* ============================================================== */}
      <View style={styles.gridWrapper}>
        <FlatList
          data={sortedSeries}
          keyExtractor={(item) => String(item.series_id)}
          numColumns={6}
          showsVerticalScrollIndicator={false}
          initialNumToRender={18}
          maxToRenderPerBatch={24}
          windowSize={9}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const isFav = favoriteIds.includes(item.series_id);
            return (
              <FocusableCard
                title={item.name}
                imageUrl={item.cover}
                type="series"
                rating={
                  item.rating_5based
                    ? (Number(item.rating_5based) * 2).toFixed(1)
                    : undefined
                }
                width={128}
                aspectRatio={2 / 3}
                badge={isFav ? '⭐' : undefined}
                onFocus={() => handleFocusSeries(item)}
                onPress={() => handleOpenDetails(item)}
              />
            );
          }}
        />
      </View>

      {/* ============================================================== */}
      {/* 4. TELA DE DETALHES COMPLETA DA SÉRIE (PADRÃO IMAGEM 4)        */}
      {/* ============================================================== */}
      <Modal
        visible={!!selectedSeriesForDetails}
        transparent={false}
        animationType="fade"
        onRequestClose={handleCloseDetails}
      >
        <View style={styles.detailsScreenContainer}>
          {/* Top Bar com Botão Voltar Padronizado (Imagem 3) */}
          <View style={styles.detailsTopBar}>
            <TVBackButton onPress={handleCloseDetails} label="Voltar" />
          </View>

          <ScrollView
            style={styles.detailsScrollView}
            contentContainerStyle={styles.detailsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Backdrop Imersivo Superior com Degradê */}
            {detailsBackdrop ? (
              <Image
                source={{ uri: detailsBackdrop }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : null}
            <LinearGradient
              colors={['rgba(7, 10, 18, 0.85)', 'rgba(7, 10, 18, 0.96)', '#070A12']}
              style={StyleSheet.absoluteFill}
            />

            {/* Hero Section: Side-by-Side (Imagem 3 Standard) */}
            <View style={styles.heroRow}>
              {/* Left: Poster with "DESTAQUE" Badge */}
              <View style={styles.posterWrapper}>
                {selectedSeriesForDetails?.cover ? (
                  <Image
                    source={{ uri: selectedSeriesForDetails.cover }}
                    style={styles.posterImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.posterPlaceholder}>
                    <Ionicons name="tv" size={40} color="#666" />
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
                  <Text style={styles.ratingText}>⭐ {detailsRating}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.yearText}>{detailsYear}</Text>
                </View>

                {/* Title */}
                <Text style={styles.detailsMainTitle} numberOfLines={2}>
                  {selectedSeriesForDetails?.name}
                </Text>

                {/* Synopsis */}
                <Text style={styles.detailsPlotText} numberOfLines={3}>
                  {focusedEpisode?.info?.plot || detailsPlot}
                </Text>

                {/* Tags: [ Cinema TV ] [ Comédia ] X Temporadas */}
                <View style={styles.genreRow}>
                  <View style={styles.genreChip}>
                    <Text style={styles.genreChipText}>{detailsGenre || 'Cinema TV'}</Text>
                  </View>
                  <View style={styles.genreChip}>
                    <Text style={styles.genreChipText}>
                      {seasonKeys.length} {seasonKeys.length === 1 ? 'Temporada' : 'Temporadas'}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons Row (Imagem 3) */}
                <View style={styles.actionsRow}>
                  {/* Assistir / Continuar Assistindo (Padrão Branco Sólido de Alto Contraste) */}
                  <Pressable
                    focusable={true}
                    hasTVPreferredFocus={true}
                    onFocus={() => setFocusedActionBtn('play')}
                    onBlur={() => setFocusedActionBtn(null)}
                    onPress={handlePlayFirstEpisode}
                    style={[
                      styles.watchButton,
                      focusedActionBtn === 'play' && styles.watchButtonFocused,
                    ]}
                  >
                    <Ionicons name="play" size={20} color="#070A12" />
                    <Text style={styles.watchButtonText}>
                      {hasEpisodeProgress
                        ? focusedEpisode
                          ? `Continuar T${focusedEpisode.season}:E${focusedEpisode.episode_num}`
                          : savedEpisodeProgress?.seasonNum && savedEpisodeProgress?.episodeNum
                          ? `Continuar T${savedEpisodeProgress.seasonNum}:E${savedEpisodeProgress.episodeNum}`
                          : 'Continuar Assistindo'
                        : focusedEpisode
                        ? `Assistir T${focusedEpisode.season}:E${focusedEpisode.episode_num}`
                        : 'Assistir T1:E1'}
                    </Text>
                  </Pressable>

                  {/* + Minha lista */}
                  <Pressable
                    focusable={true}
                    onFocus={() => setFocusedActionBtn('list')}
                    onBlur={() => setFocusedActionBtn(null)}
                    onPress={() => selectedSeriesForDetails && handleToggleMyList(selectedSeriesForDetails)}
                    style={[
                      styles.actionIconBtn,
                      focusedActionBtn === 'list' && styles.actionIconBtnFocused,
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
                    onFocus={() => setFocusedActionBtn('later')}
                    onBlur={() => setFocusedActionBtn(null)}
                    onPress={() => selectedSeriesForDetails && handleToggleWatchLater(selectedSeriesForDetails)}
                    style={[
                      styles.actionIconBtn,
                      focusedActionBtn === 'later' && styles.actionIconBtnFocused,
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
                    onFocus={() => setFocusedActionBtn('fav')}
                    onBlur={() => setFocusedActionBtn(null)}
                    onPress={() => selectedSeriesForDetails && handleToggleFavorite(selectedSeriesForDetails)}
                    style={[
                      styles.actionIconBtn,
                      focusedActionBtn === 'fav' && styles.actionIconBtnFocused,
                    ]}
                  >
                    <Ionicons
                      name={
                        selectedSeriesForDetails && favoriteIds.includes(selectedSeriesForDetails.series_id)
                          ? 'star'
                          : 'star-outline'
                      }
                      size={20}
                      color={
                        selectedSeriesForDetails && favoriteIds.includes(selectedSeriesForDetails.series_id)
                          ? '#FFD700'
                          : '#FFFFFF'
                      }
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        selectedSeriesForDetails &&
                          favoriteIds.includes(selectedSeriesForDetails.series_id) && {
                            color: '#FFD700',
                          },
                      ]}
                    >
                      Favoritar
                    </Text>
                  </Pressable>

                  {/* [ 📺 Trailer ] */}
                  {seriesDetails?.info?.youtube_trailer ? (
                    <Pressable
                      focusable={true}
                      onFocus={() => setFocusedActionBtn('trailer')}
                      onBlur={() => setFocusedActionBtn(null)}
                      onPress={() => {
                        const tr = seriesDetails.info.youtube_trailer;
                        const url = tr.startsWith('http') ? tr : `https://www.youtube.com/watch?v=${tr}`;
                        Linking.openURL(url).catch(() => {});
                      }}
                      style={[
                        styles.trailerButton,
                        focusedActionBtn === 'trailer' && styles.actionIconBtnFocused,
                      ]}
                    >
                      <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                      <Text style={styles.trailerButtonText}>Trailer</Text>
                    </Pressable>
                  ) : null}

                  {/* Rating & Year Badge */}
                  <View style={styles.ratingBox}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.ratingNumber}>{detailsRating}</Text>
                    <Text style={styles.ratingDivider}>|</Text>
                    <Text style={styles.ratingYear}>{detailsYear}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* SELETOR DE TEMPORADAS E EPISÓDIOS (PARA SÉRIES) */}
            {seasonKeys.length > 0 && (
              <View style={styles.seasonsSection}>
                <View style={styles.seasonBarTitleRow}>
                  <Text style={styles.sectionHeaderTitle}>TEMPORADAS & EPISÓDIOS</Text>
                </View>

                {/* Seletor Horizontal de Temporadas */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seasonPillsScroll}
                >
                  {seasonKeys.map((seasonKey) => {
                    const isSelected = selectedSeasonNumber === seasonKey;
                    const seasonEpsCount = seriesDetails?.episodes?.[seasonKey]?.length || 0;
                    return (
                      <FocusablePill
                        key={seasonKey}
                        label={`Temporada ${seasonKey} (${seasonEpsCount})`}
                        variant="tab"
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

                {/* Carrossel Horizontal de Episódios */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.episodesScroll}
                >
                  {currentEpisodes.map((ep, idx) => {
                    const isEpisodeFocused = focusedEpisode?.id === ep.id;
                    const epCover = ep.info?.movie_image || selectedSeriesForDetails?.cover;
                    return (
                      <Pressable
                        key={ep.id}
                        focusable={true}
                        onFocus={() => setFocusedEpisode(ep)}
                        onPress={() => handlePlayEpisode(ep)}
                        style={({ focused }: any) => [
                          styles.episodeCard,
                          (focused || isEpisodeFocused) && styles.episodeCardFocused,
                        ]}
                      >
                        <View style={styles.episodeThumbBox}>
                          <EnrichedPosterImage
                            sourceUri={epCover}
                            title={ep.title}
                            type="series"
                            style={StyleSheet.absoluteFill}
                            containerStyle={StyleSheet.absoluteFill}
                            contentFit="cover"
                            fallbackIcon="play-circle-outline"
                          />
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.85)']}
                            style={StyleSheet.absoluteFill}
                          />
                          <View style={styles.episodeBadge}>
                            <Text style={styles.episodeBadgeText}>
                              EP. {String(ep.episode_num || idx + 1).padStart(2, '0')}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.episodeInfoBox}>
                          <Text style={styles.episodeCardTitle} numberOfLines={1}>
                            {ep.title}
                          </Text>
                          <Text style={styles.episodeCardPlot} numberOfLines={2}>
                            {ep.info?.plot || 'Reproduzir episódio em alta definição.'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Seção "Você também pode gostar" (Carrossel Horizontal de Recomendados) */}
            {relatedSeries.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={styles.relatedSectionTitle}>Você também pode gostar</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.relatedCarousel}
                >
                  {relatedSeries.map((item) => (
                    <FocusableCard
                      key={item.series_id}
                      title={item.name}
                      imageUrl={item.cover}
                      type="series"
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

  /* 2. Grid de Séries */
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

  /* 4. Tela de Detalhes Completa da Série (Imagem 4) */
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
  /* Hero Side-by-Side (Imagem 3 Standard) */
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
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

  /* Seção de Temporadas e Episódios */
  seasonsSection: {
    marginTop: 28,
    paddingHorizontal: 36,
  },
  seasonBarTitleRow: {
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  seasonPillsScroll: {
    gap: 10,
    paddingBottom: 16,
  },
  seasonPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#151C30',
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  seasonPillSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
  },
  seasonPillFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(0, 229, 255, 0.3)',
    transform: [{ scale: 1.05 }],
  },
  seasonPillText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
  },
  seasonPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  episodesScroll: {
    gap: 14,
    paddingBottom: 16,
  },
  episodeCard: {
    width: 220,
    backgroundColor: '#0E1322',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  episodeCardFocused: {
    borderColor: colors.focusRing,
    transform: [{ scale: 1.05 }],
  },
  episodeThumbBox: {
    height: 124,
    backgroundColor: '#151C30',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  episodeBadgeText: {
    color: '#070A12',
    fontSize: 9,
    fontWeight: '900',
  },
  episodeInfoBox: {
    padding: 10,
  },
  episodeCardTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  episodeCardPlot: {
    color: '#8E8E93',
    fontSize: 11,
    lineHeight: 15,
  },

  /* Seção "Você também pode gostar" */
  relatedSection: {
    marginTop: 28,
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
