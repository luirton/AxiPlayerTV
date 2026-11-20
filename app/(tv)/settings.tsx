import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { FocusableButton } from '../../src/components/tv/FocusableButton';
import { storage } from '../../src/services/storage';
import { xtreamClient, XtreamClient } from '../../src/services/xtreamClient';
import { colors } from '../../src/theme/colors';

export default function TVSettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [isReloadingList, setIsReloadingList] = useState<boolean>(false);

  // Lists Data
  const [favChannels, setFavChannels] = useState<any[]>([]);
  const [favMovies, setFavMovies] = useState<any[]>([]);
  const [favSeries, setFavSeries] = useState<any[]>([]);
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [myList, setMyList] = useState<any[]>([]);
  const [watchLater, setWatchLater] = useState<any[]>([]);

  // List Manager Modal State
  const [listManagerVisible, setListManagerVisible] = useState<boolean>(false);
  const [listManagerTab, setListManagerTab] = useState<'favorites' | 'continue' | 'mylist' | 'watchlater'>('favorites');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'live' | 'movie' | 'series'>('all');

  const firstFocusRef = React.useRef<any>(null);

  useEffect(() => {
    loadSettings();
    const timer = setTimeout(() => {
      firstFocusRef.current?.focus?.();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  const loadSettings = async () => {
    const [active, currentSettings, channels, movies, series, list, later, progress] = await Promise.all([
      storage.getActiveProfile(),
      storage.getSettings(),
      storage.getFavoriteChannels(),
      storage.getFavoriteMovies(),
      storage.getFavoriteSeries(),
      storage.getMyList(),
      storage.getWatchLater(),
      storage.getAllWatchProgress(),
    ]);
    setProfile(active);
    setSettings(currentSettings);
    setFavChannels(channels || []);
    setFavMovies(movies || []);
    setFavSeries(series || []);
    setMyList(list || []);
    setWatchLater(later || []);
    setContinueWatching(progress || []);
  };

  const handleSelectReloadDays = async (days: number) => {
    const updated = await storage.saveSettings({ playlistReloadDays: days });
    setSettings(updated);
  };

  const handleForceReloadPlaylist = async () => {
    if (!profile) {
      Alert.alert('Conta não encontrada', 'Faça login novamente.');
      return;
    }
    setIsReloadingList(true);
    try {
      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);
      await XtreamClient.clearPersistentCache();

      await Promise.all([
        xtreamClient.getLiveCategories(),
        xtreamClient.getVodCategories(),
        xtreamClient.getSeriesCategories(),
      ]);

      await storage.markPlaylistReloaded();
      const updated = await storage.getSettings();
      setSettings(updated);
      Alert.alert(
        'Lista Atualizada',
        'Canais, filmes e séries foram sincronizados com sucesso junto ao servidor IPTV!'
      );
    } catch (e: any) {
      Alert.alert('Erro ao Atualizar', e?.message || 'Falha ao conectar ao servidor IPTV.');
    } finally {
      setIsReloadingList(false);
    }
  };

  const getLastReloadText = () => {
    const last = settings?.lastPlaylistReloadTimestamp;
    if (!last) return 'Nunca sincronizado';
    const diffHours = Math.floor((Date.now() - last) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Atualizado há poucos minutos';
    if (diffHours < 24) return `Atualizado há ${diffHours} horas`;
    const diffDays = Math.floor(diffHours / 24);
    return `Atualizado há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Limpar Cache',
      'Deseja limpar os dados temporários de EPG, capas e memória?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            await XtreamClient.clearPersistentCache();
            Alert.alert('Sucesso', 'Cache temporário de TV esvaziado.');
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza que deseja desconectar este perfil de TV?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            await storage.clearActiveProfile();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const totalFavoritesCount = (favChannels || []).length + (favMovies || []).length + (favSeries || []).length;
  const continueMoviesCount = (continueWatching || []).filter((i) => i && i.type !== 'series').length;
  const continueSeriesCount = (continueWatching || []).filter((i) => i && i.type === 'series').length;
  const myListMoviesCount = (myList || []).filter((i) => i && i.type === 'movie').length;
  const myListSeriesCount = (myList || []).filter((i) => i && i.type === 'series').length;
  const watchLaterMoviesCount = (watchLater || []).filter((i) => i && i.type === 'movie').length;
  const watchLaterSeriesCount = (watchLater || []).filter((i) => i && i.type === 'series').length;

  const currentTabTotalCount =
    listManagerTab === 'favorites'
      ? totalFavoritesCount
      : listManagerTab === 'continue'
      ? continueWatching.length
      : listManagerTab === 'mylist'
      ? myList.length
      : watchLater.length;

  const currentTabMoviesCount =
    listManagerTab === 'favorites'
      ? favMovies.length
      : listManagerTab === 'continue'
      ? continueMoviesCount
      : listManagerTab === 'mylist'
      ? myListMoviesCount
      : watchLaterMoviesCount;

  const currentTabSeriesCount =
    listManagerTab === 'favorites'
      ? favSeries.length
      : listManagerTab === 'continue'
      ? continueSeriesCount
      : listManagerTab === 'mylist'
      ? myListSeriesCount
      : watchLaterSeriesCount;

  const handleOpenListManager = (tab: 'favorites' | 'continue' | 'mylist' | 'watchlater') => {
    setListManagerTab(tab);
    setCategoryFilter('all');
    setListManagerVisible(true);
  };

  const handleChangeTab = (tab: 'favorites' | 'continue' | 'mylist' | 'watchlater') => {
    setListManagerTab(tab);
    setCategoryFilter('all');
  };

  const handlePlayListItem = (item: {
    id: string | number;
    type: 'live' | 'movie' | 'series';
    title: string;
    poster?: string;
    extension?: string;
    streamUrl?: string;
    startPosition?: number | string;
    seriesId?: string;
    seriesTitle?: string;
    seasonNum?: number | string;
    episodeNum?: number | string;
  }) => {
    setListManagerVisible(false);
    if (item.type === 'live') {
      router.push({
        pathname: '/(tv)/live',
        params: { channelId: String(item.id) },
      });
    } else {
      router.push({
        pathname: '/player/[id]',
        params: {
          id: String(item.id),
          type: item.type,
          name: item.title,
          container: item.extension || 'mp4',
          icon: item.poster,
          streamUrl: item.streamUrl,
          startPosition: item.startPosition ? String(item.startPosition) : undefined,
          seriesId: item.seriesId,
          seriesTitle: item.seriesTitle,
          seasonNum: item.seasonNum ? String(item.seasonNum) : undefined,
          episodeNum: item.episodeNum ? String(item.episodeNum) : undefined,
        },
      });
    }
  };

  const handleRemoveListItem = (
    tab: 'favorites' | 'continue' | 'mylist' | 'watchlater',
    item: { id: string | number; type: 'live' | 'movie' | 'series'; title: string }
  ) => {
    const isContinue = tab === 'continue';
    Alert.alert(
      isContinue ? 'Remover do Histórico' : 'Remover Item',
      isContinue
        ? `Deseja remover "${item.title}" de Continuar Assistindo?`
        : `Deseja remover "${item.title}" desta lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            if (tab === 'favorites') {
              if (item.type === 'live') {
                await storage.removeFavoriteChannel(Number(item.id));
              } else if (item.type === 'movie') {
                await storage.removeFavoriteMovie(Number(item.id));
              } else {
                await storage.removeFavoriteSeries(Number(item.id));
              }
            } else if (tab === 'continue') {
              await storage.removeWatchProgress(item.id);
            } else if (tab === 'mylist') {
              await storage.removeFromMyList(item.id);
            } else if (tab === 'watchlater') {
              await storage.removeFromWatchLater(item.id);
            }
            await loadSettings();
          },
        },
      ]
    );
  };

  const getDisplayedItems = () => {
    if (listManagerTab === 'favorites') {
      let items: Array<{
        id: string | number;
        title: string;
        poster?: string;
        type: 'live' | 'movie' | 'series';
        subtitle: string;
        extension?: string;
        streamUrl?: string;
        startPosition?: number | string;
        seriesId?: string;
        seriesTitle?: string;
        seasonNum?: number | string;
        episodeNum?: number | string;
        progressPct?: number;
      }> = [];

      if (categoryFilter === 'all' || categoryFilter === 'live') {
        items = items.concat(
          (favChannels || []).map((c) => ({
            id: c.stream_id,
            title: c.name,
            poster: c.stream_icon,
            type: 'live' as const,
            subtitle: 'TV Ao Vivo',
          }))
        );
      }
      if (categoryFilter === 'all' || categoryFilter === 'movie') {
        items = items.concat(
          (favMovies || []).map((m) => ({
            id: m.stream_id,
            title: m.name,
            poster: m.stream_icon,
            type: 'movie' as const,
            subtitle: `Filme ${m.rating ? '• ⭐ ' + m.rating : ''}`,
            extension: m.container_extension || 'mp4',
          }))
        );
      }
      if (categoryFilter === 'all' || categoryFilter === 'series') {
        items = items.concat(
          (favSeries || []).map((s) => ({
            id: s.series_id,
            title: s.name,
            poster: s.cover,
            type: 'series' as const,
            subtitle: `Série ${s.rating ? '• ⭐ ' + s.rating : ''}`,
          }))
        );
      }
      return items;
    }

    if (listManagerTab === 'continue') {
      let items = (continueWatching || []).filter(Boolean);
      if (categoryFilter === 'movie') {
        items = items.filter((i) => i.type !== 'series');
      } else if (categoryFilter === 'series') {
        items = items.filter((i) => i.type === 'series');
      }
      return items.map((i) => {
        const posSec = i.positionSec || 0;
        const durSec = i.durationSec || 0;
        const pct = durSec > 0 ? Math.round((posSec / durSec) * 100) : 0;
        const posMin = Math.floor(posSec / 60);
        const durMin = Math.floor(durSec / 60);
        const timeText = durMin > 0 ? `${posMin} min de ${durMin} min (${pct}%)` : `${posMin} min assistidos`;
        return {
          id: i.id,
          title: i.title || 'Sem título',
          poster: i.poster,
          type: (i.type === 'live' ? 'live' : i.type === 'series' ? 'series' : 'movie') as 'live' | 'movie' | 'series',
          subtitle: `${i.type === 'series' ? 'Série' : 'Filme'} • ${timeText}`,
          progressPct: pct,
          extension: i.extension,
          streamUrl: i.streamUrl,
          startPosition: i.positionSec,
          seriesId: i.seriesId ? String(i.seriesId) : undefined,
          seriesTitle: i.seriesTitle,
          seasonNum: i.seasonNum,
          episodeNum: i.episodeNum,
        };
      });
    }

    if (listManagerTab === 'mylist') {
      let items = (myList || []).filter(Boolean);
      if (categoryFilter === 'movie') {
        items = items.filter((i) => i.type === 'movie');
      } else if (categoryFilter === 'series') {
        items = items.filter((i) => i.type === 'series');
      }
      return items.map((i) => ({
        id: i.id,
        title: i.title || 'Sem título',
        poster: i.poster,
        type: i.type,
        subtitle: `${i.type === 'movie' ? 'Filme' : 'Série'}${i.genre ? ' • ' + i.genre : ''}`,
        extension: i.extension,
      }));
    }

    let items = (watchLater || []).filter(Boolean);
    if (categoryFilter === 'movie') {
      items = items.filter((i) => i.type === 'movie');
    } else if (categoryFilter === 'series') {
      items = items.filter((i) => i.type === 'series');
    }
    return items.map((i) => ({
      id: i.id,
      title: i.title || 'Sem título',
      poster: i.poster,
      type: i.type,
      subtitle: `${i.type === 'movie' ? 'Filme' : 'Série'}${i.genre ? ' • ' + i.genre : ''}`,
      extension: i.extension,
    }));
  };

  const getEmptyMessage = () => {
    if (categoryFilter !== 'all') {
      const typeLabel =
        categoryFilter === 'live'
          ? 'de TV ao vivo'
          : categoryFilter === 'movie'
          ? 'de filme'
          : 'de série';
      return `Nenhum item ${typeLabel} encontrado nesta categoria.`;
    }
    if (listManagerTab === 'favorites') {
      return 'Você ainda não favoritou canais, filmes ou séries.';
    }
    if (listManagerTab === 'continue') {
      return 'Nenhum vídeo em andamento no histórico de reprodução.';
    }
    if (listManagerTab === 'mylist') {
      return 'Sua lista está vazia. Adicione filmes ou séries para acompanhar.';
    }
    return 'Nenhum título foi marcado para assistir depois.';
  };

  const currentReloadDays = settings?.playlistReloadDays || 3;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Configurações do Axi Player TV</Text>
      <Text style={styles.headerSubtitle}>Gerenciamento de conta, sincronização e sistema</Text>

      {/* Minhas Listas & Coleções */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📂 MINHAS LISTAS & COLEÇÕES</Text>
        <Text style={styles.sectionSubtitle}>
          Gerencie seus títulos favoritos, lista pessoal e histórico de reprodução:
        </Text>

        <View style={styles.listManagerGrid}>
          {/* Card Meus Favoritos */}
          <Pressable
            ref={firstFocusRef}
            focusable={true}
            hasTVPreferredFocus={true}
            style={({ focused }: any) => [
              styles.listManagerTile,
              focused && styles.listManagerTileFocused,
            ]}
            onPress={() => handleOpenListManager('favorites')}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
              <Ionicons name="star" size={24} color="#FFD700" />
            </View>
            <View style={styles.tileTextContainer}>
              <Text style={styles.tileTitle}>⭐ Meus Favoritos</Text>
              <Text style={styles.tileSub}>Canais, Filmes e Séries</Text>
            </View>
            <View style={styles.tileBadge}>
              <Text style={styles.tileBadgeText}>{totalFavoritesCount}</Text>
            </View>
          </Pressable>

          {/* Card Continuar Assistindo */}
          <Pressable
            focusable={true}
            style={({ focused }: any) => [
              styles.listManagerTile,
              focused && styles.listManagerTileFocused,
            ]}
            onPress={() => handleOpenListManager('continue')}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
              <Ionicons name="play-forward-circle" size={24} color="#00E5FF" />
            </View>
            <View style={styles.tileTextContainer}>
              <Text style={styles.tileTitle}>▶ Continuar Assistindo</Text>
              <Text style={styles.tileSub}>Histórico em andamento</Text>
            </View>
            <View style={styles.tileBadge}>
              <Text style={styles.tileBadgeText}>{continueWatching.length}</Text>
            </View>
          </Pressable>

          {/* Card Minha Lista */}
          <Pressable
            focusable={true}
            style={({ focused }: any) => [
              styles.listManagerTile,
              focused && styles.listManagerTileFocused,
            ]}
            onPress={() => handleOpenListManager('mylist')}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(0, 168, 225, 0.15)' }]}>
              <Ionicons name="bookmark" size={24} color={colors.primary} />
            </View>
            <View style={styles.tileTextContainer}>
              <Text style={styles.tileTitle}>📑 Minha Lista</Text>
              <Text style={styles.tileSub}>Títulos salvos na sua lista</Text>
            </View>
            <View style={styles.tileBadge}>
              <Text style={styles.tileBadgeText}>{myList.length}</Text>
            </View>
          </Pressable>

          {/* Card Assistir Depois */}
          <Pressable
            focusable={true}
            style={({ focused }: any) => [
              styles.listManagerTile,
              focused && styles.listManagerTileFocused,
            ]}
            onPress={() => handleOpenListManager('watchlater')}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(255, 159, 10, 0.15)' }]}>
              <Ionicons name="time" size={24} color="#FF9F0A" />
            </View>
            <View style={styles.tileTextContainer}>
              <Text style={styles.tileTitle}>🕒 Assistir Depois</Text>
              <Text style={styles.tileSub}>Títulos para assistir mais tarde</Text>
            </View>
            <View style={styles.tileBadge}>
              <Text style={styles.tileBadgeText}>{watchLater.length}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Sincronização & Intervalo de Recarga (3 a 5 dias) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 SINCRONIZAÇÃO DA LISTA IPTV</Text>
        <Text style={styles.sectionSubtitle}>
          Defina o intervalo em dias para recarregar canais e filmes automaticamente ao ligar a TV:
        </Text>

        <View style={styles.reloadDaysRow}>
          {[3, 4, 5].map((days) => {
            const isSelected = currentReloadDays === days;
            return (
              <Pressable
                key={days}
                focusable={true}
                hasTVPreferredFocus={isSelected}
                onPress={() => handleSelectReloadDays(days)}
                style={({ focused }: any) => [
                  styles.reloadDayPill,
                  isSelected && styles.reloadDayPillSelected,
                  focused && styles.reloadDayPillFocused,
                ]}
              >
                {({ focused }: any) => (
                  <>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={focused ? '#070A12' : isSelected ? colors.primary : '#6E7687'}
                    />
                    <Text
                      style={[
                        styles.reloadDayText,
                        isSelected && styles.reloadDayTextSelected,
                        focused && styles.reloadDayTextFocused,
                      ]}
                    >
                      {days} Dias {days === 5 ? '(Recomendado)' : ''}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.reloadStatusRow}>
          <View>
            <Text style={styles.statusLabel}>Última Atualização:</Text>
            <Text style={styles.statusValue}>{getLastReloadText()}</Text>
          </View>

          <FocusableButton
            label={isReloadingList ? 'Sincronizando...' : 'Atualizar Lista Agora'}
            icon="sync"
            variant="primary"
            onPress={handleForceReloadPlaylist}
          />
        </View>
      </View>

      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👤 PERFIL ATIVO</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nome:</Text>
          <Text style={styles.infoValue}>{profile?.name || 'Servidor TV'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Servidor:</Text>
          <Text style={styles.infoValue}>{profile?.serverUrl || 'Não informado'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, { color: '#4CD964' }]}>Conectado e Autorizado</Text>
        </View>
      </View>

      {/* Playback Settings Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ PREFERÊNCIAS DE TRANSMISSÃO</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Formato Padrão:</Text>
          <Text style={styles.infoValue}>MPEG-TS (.ts) de Alta Resolução</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Motor de Vídeo:</Text>
          <Text style={styles.infoValue}>ExoPlayer Nativo (Hardware Decoding Ativo)</Text>
        </View>
      </View>

      {/* Developer & Version Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⭐ AUTORIA & DESENVOLVIMENTO</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Desenvolvedor Oficial:</Text>
          <Text style={[styles.infoValue, { color: colors.primary }]}>Luirton Gurgel</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Repositório:</Text>
          <Text style={styles.infoValue}>github.com/luirton</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Versão:</Text>
          <Text style={styles.infoValue}>v1.0.0 (Google TV & Android TV)</Text>
        </View>
      </View>

      {/* System Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛠️ AÇÕES DO APLICATIVO</Text>
        <View style={styles.actionButtons}>
          <FocusableButton
            label="Limpar Cache do EPG & Capas"
            icon="trash-bin-outline"
            variant="secondary"
            onPress={handleClearCache}
            style={styles.btnSpacing}
          />
          <FocusableButton
            label="Desconectar Servidor"
            icon="log-out-outline"
            variant="danger"
            onPress={handleLogout}
            style={styles.btnSpacing}
          />
        </View>
      </View>
      {/* Modal: Gerenciador de Listas & Coleções */}
      <Modal
        visible={listManagerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setListManagerVisible(false)}
      >
        <View style={styles.tvModalOverlay}>
          <View style={styles.tvModalContent}>
            {/* Modal Header */}
            <View style={styles.tvModalHeader}>
              <View style={styles.tvModalHeaderTitleBox}>
                <Ionicons
                  name={
                    listManagerTab === 'favorites'
                      ? 'star'
                      : listManagerTab === 'continue'
                      ? 'play-forward-circle'
                      : listManagerTab === 'mylist'
                      ? 'bookmark'
                      : 'time'
                  }
                  size={26}
                  color={
                    listManagerTab === 'favorites'
                      ? '#FFD700'
                      : listManagerTab === 'continue'
                      ? '#00E5FF'
                      : colors.primary
                  }
                />
                <Text style={styles.tvModalTitle}>
                  {listManagerTab === 'favorites'
                    ? 'Meus Favoritos'
                    : listManagerTab === 'continue'
                    ? 'Continuar Assistindo'
                    : listManagerTab === 'mylist'
                    ? 'Minha Lista'
                    : 'Assistir Depois'}
                </Text>
              </View>

              <Pressable
                focusable={true}
                style={({ focused }: any) => [
                  styles.tvModalCloseBtn,
                  focused && styles.tvBtnFocused,
                ]}
                onPress={() => setListManagerVisible(false)}
              >
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={styles.tvModalCloseBtnText}>Fechar</Text>
              </Pressable>
            </View>

            {/* Abas Superiores */}
            <View style={styles.tvTabsRow}>
              {(['favorites', 'continue', 'mylist', 'watchlater'] as const).map((tab) => {
                const isActive = listManagerTab === tab;
                const tabLabel =
                  tab === 'favorites'
                    ? `Favoritos (${totalFavoritesCount})`
                    : tab === 'continue'
                    ? `Continuar (${continueWatching.length})`
                    : tab === 'mylist'
                    ? `Minha Lista (${myList.length})`
                    : `Depois (${watchLater.length})`;
                return (
                  <Pressable
                    key={tab}
                    focusable={true}
                    style={({ focused }: any) => [
                      styles.tvTabItem,
                      isActive && styles.tvTabItemActive,
                      focused && styles.tvTabItemFocused,
                    ]}
                    onPress={() => handleChangeTab(tab)}
                  >
                    <Text
                      style={[
                        styles.tvTabText,
                        isActive && styles.tvTabTextActive,
                      ]}
                    >
                      {tabLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Subfiltro de Categorias */}
            <View style={styles.tvFilterRow}>
              {(['all', 'live', 'movie', 'series'] as const).map((cat) => {
                if (cat === 'live' && listManagerTab !== 'favorites') return null;
                const isActive = categoryFilter === cat;
                const count =
                  cat === 'all'
                    ? currentTabTotalCount
                    : cat === 'live'
                    ? (favChannels || []).length
                    : cat === 'movie'
                    ? currentTabMoviesCount
                    : currentTabSeriesCount;
                const label =
                  cat === 'all'
                    ? `Todos (${count})`
                    : cat === 'live'
                    ? `Ao Vivo (${count})`
                    : cat === 'movie'
                    ? `Filmes (${count})`
                    : `Séries (${count})`;
                return (
                  <Pressable
                    key={cat}
                    focusable={true}
                    style={({ focused }: any) => [
                      styles.tvFilterChip,
                      isActive && styles.tvFilterChipActive,
                      focused && styles.tvChipFocused,
                    ]}
                    onPress={() => setCategoryFilter(cat)}
                  >
                    <Text
                      style={[
                        styles.tvFilterChipText,
                        isActive && styles.tvFilterChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Lista de Itens */}
            {getDisplayedItems().length === 0 ? (
              <View style={styles.tvEmptyBox}>
                <Ionicons name="folder-open-outline" size={54} color="#445" />
                <Text style={styles.tvEmptyTitle}>Nenhum item encontrado</Text>
                <Text style={styles.tvEmptyDesc}>{getEmptyMessage()}</Text>
              </View>
            ) : (
              <FlatList
                style={styles.tvItemsFlatList}
                data={getDisplayedItems()}
                keyExtractor={(item) => `${item.type}_${item.id}`}
                contentContainerStyle={styles.tvItemsContent}
                renderItem={({ item }) => (
                  <View style={styles.tvItemCard}>
                    <View style={styles.tvItemPosterBox}>
                      {item.poster ? (
                        <Image
                          source={{ uri: item.poster }}
                          style={styles.tvItemPoster}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons
                          name={item.type === 'live' ? 'tv' : item.type === 'movie' ? 'film' : 'albums'}
                          size={24}
                          color="#777"
                        />
                      )}
                      {item.progressPct !== undefined && item.progressPct > 0 ? (
                        <View style={styles.tvPosterProgressBarTrack}>
                          <View
                            style={[
                              styles.tvPosterProgressBarFill,
                              { width: `${Math.min(Math.max(item.progressPct, 5), 100)}%` },
                            ]}
                          />
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.tvItemInfo}>
                      <Text style={styles.tvItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.tvItemSub} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>

                    <View style={styles.tvItemActions}>
                      <Pressable
                        focusable={true}
                        style={({ focused }: any) => [
                          styles.tvActionPlayBtn,
                          focused && styles.tvActionPlayBtnFocused,
                        ]}
                        onPress={() => handlePlayListItem(item)}
                      >
                        <Ionicons name="play" size={16} color="#000" />
                        <Text style={styles.tvActionPlayBtnText}>Assistir</Text>
                      </Pressable>

                      <Pressable
                        focusable={true}
                        style={({ focused }: any) => [
                          styles.tvActionRemoveBtn,
                          focused && styles.tvActionRemoveBtnFocused,
                        ]}
                        onPress={() => handleRemoveListItem(listManagerTab, item)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#FF4D4F" />
                        <Text style={styles.tvActionRemoveBtnText}>Remover</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A12',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#9AA4BC',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#0E1322',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#1B2338',
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#9AA4BC',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  reloadDaysRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  reloadDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#151C30',
    borderWidth: 1.5,
    borderColor: '#1B2338',
  },
  reloadDayPillSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
  },
  reloadDayPillFocused: {
    backgroundColor: colors.primary,
    borderColor: '#FFFFFF',
    borderWidth: 2.5,
    transform: [{ scale: 1.08 }],
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
  },
  reloadDayText: {
    color: '#C5C9D6',
    fontSize: 13,
    fontWeight: '700',
  },
  reloadDayTextSelected: {
    color: colors.primary,
  },
  reloadDayTextFocused: {
    color: '#070A12',
    fontWeight: '900',
  },
  reloadStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1B2338',
  },
  statusLabel: {
    color: '#6E7687',
    fontSize: 11,
    fontWeight: '600',
  },
  statusValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1B2338',
  },
  infoLabel: {
    color: '#9AA4BC',
    fontSize: 13,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  btnSpacing: {
    marginRight: 16,
  },

  /* Grid de Listas & Coleções no TV Settings */
  listManagerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 6,
    marginBottom: 4,
  },
  listManagerTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13192B',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1F2942',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 260,
    flex: 1,
    gap: 12,
  },
  listManagerTileFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    transform: [{ scale: 1.03 }],
  },
  tileIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  tileTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  tileSub: {
    color: '#8E99AF',
    fontSize: 11,
  },
  tileBadge: {
    backgroundColor: '#1E273E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2F3C5E',
  },
  tileBadgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },

  /* Modal de Gerenciamento TV */
  tvModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  tvModalContent: {
    width: '90%',
    maxHeight: '90%',
    backgroundColor: '#0B0F1B',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1E273E',
    padding: 24,
  },
  tvModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E273E',
    marginBottom: 16,
  },
  tvModalHeaderTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tvModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  tvModalCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1C2438',
    borderWidth: 1.5,
    borderColor: '#2D3A58',
  },
  tvModalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tvBtnFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tvTabsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  tvTabItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#13192B',
    borderWidth: 1.5,
    borderColor: '#1E273E',
  },
  tvTabItemActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
  },
  tvTabItemFocused: {
    borderColor: colors.focusRing,
    transform: [{ scale: 1.05 }],
  },
  tvTabText: {
    color: '#8E99AF',
    fontSize: 13,
    fontWeight: '700',
  },
  tvTabTextActive: {
    color: '#FFFFFF',
  },
  tvFilterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tvFilterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#121727',
    borderWidth: 1,
    borderColor: '#1E273E',
  },
  tvFilterChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
  },
  tvChipFocused: {
    borderColor: colors.focusRing,
    transform: [{ scale: 1.06 }],
  },
  tvFilterChipText: {
    color: '#8E99AF',
    fontSize: 12,
    fontWeight: '600',
  },
  tvFilterChipTextActive: {
    color: colors.primary,
  },
  tvItemsFlatList: {
    maxHeight: 380,
  },
  tvItemsContent: {
    gap: 10,
    paddingBottom: 20,
  },
  tvItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121727',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E273E',
    padding: 10,
    gap: 14,
  },
  tvItemPosterBox: {
    width: 50,
    height: 65,
    borderRadius: 6,
    backgroundColor: '#070A12',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  tvItemPoster: {
    width: '100%',
    height: '100%',
  },
  tvPosterProgressBarTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tvPosterProgressBarFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
  },
  tvItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  tvItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  tvItemSub: {
    color: '#8E99AF',
    fontSize: 12,
  },
  tvItemActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  tvActionPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  tvActionPlayBtnFocused: {
    backgroundColor: colors.primary,
    transform: [{ scale: 1.05 }],
  },
  tvActionPlayBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  tvActionRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 77, 79, 0.15)',
    borderWidth: 1,
    borderColor: '#FF4D4F',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tvActionRemoveBtnFocused: {
    backgroundColor: '#FF4D4F',
    transform: [{ scale: 1.05 }],
  },
  tvActionRemoveBtnText: {
    color: '#FF4D4F',
    fontSize: 12,
    fontWeight: '700',
  },
  tvEmptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 4,
  },
  tvEmptyDesc: {
    color: '#8E99AF',
    fontSize: 13,
  },
});
