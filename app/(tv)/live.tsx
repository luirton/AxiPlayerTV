import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  BackHandler,
  Modal,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';
import { IptvCategory, LiveChannel, EpgProgram } from '../../src/types/iptv';
import { TVLiveOSD } from '../../src/components/tv/TVLiveOSD';

export default function TVLiveScreen() {
  const router = useRouter();

  // Categories & Channels State
  const [categories, setCategories] = useState<IptvCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<IptvCategory | null>(null);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<LiveChannel | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteChannels, setFavoriteChannels] = useState<LiveChannel[]>([]);

  // Stream & Video Player State
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayerBuffering, setIsPlayerBuffering] = useState(false);

  // OSD & Remote Navigation State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [contentFit, setContentFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [currentEpg, setCurrentEpg] = useState<EpgProgram | null>(null);
  const [epgList, setEpgList] = useState<EpgProgram[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const overlayTimerRef = useRef<any>(null);
  const centerFocusRef = useRef<any>(null);
  const activeChannelRef = useRef<LiveChannel | null>(null);
  const channelsRef = useRef<LiveChannel[]>([]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  // Initialize expo-video player
  const player = useVideoPlayer(streamUrl, (p) => {
    p.loop = false;
    p.play();
  });

  // Load Categories, Favorites and Last Watched Channel on mount
  useEffect(() => {
    initLiveTv();
  }, []);

  const initLiveTv = async () => {
    try {
      setIsLoading(true);
      const profile = await storage.getActiveAccount();
      if (!profile) {
        setIsLoading(false);
        return;
      }

      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

      // Load favorites from storage
      const [favIds, favChans] = await Promise.all([
        storage.getFavorites(),
        storage.getFavoriteChannels(),
      ]);
      setFavoriteIds(favIds);
      setFavoriteChannels(favChans);

      // Fetch live categories from Xtream API
      const cats = await xtreamClient.getLiveCategories();
      const allCategories: IptvCategory[] = [];

      // Add "Favoritos" category if there are saved favorites
      if (favIds.length > 0) {
        allCategories.push({
          category_id: 'favorites',
          category_name: '⭐ Favoritos',
        });
      }
      allCategories.push(...cats);
      setCategories(allCategories);

      // Restore last watched channel or fallback to first real channel category
      const lastChannel = await storage.getLastLiveChannel();
      let initialCategory: IptvCategory | null = null;

      if (lastChannel && lastChannel.category_id && lastChannel.category_id !== 'favorites') {
        const matchingCat = cats.find((c) => String(c.category_id) === String(lastChannel.category_id));
        if (matchingCat) initialCategory = matchingCat;
      }

      // Se não encontrou categoria do último canal, inicia pela primeira categoria real (cats[0]) com todos os canais
      if (!initialCategory && cats.length > 0) {
        initialCategory = cats[0];
      } else if (!initialCategory && allCategories.length > 0) {
        initialCategory = allCategories[0];
      }

      setSelectedCategory(initialCategory);

      if (initialCategory) {
        await loadCategoryChannels(initialCategory.category_id, lastChannel || undefined);
      }
      // Inicia direto em tela cheia com o overlay de controles visível por 6 segundos
      setIsDrawerOpen(false);
      openOverlay(6000);
    } catch (err) {
      console.error('Failed to initialize Live TV:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Abre o overlay de controles do player de TV ao vivo com temporizador de auto-hide
  const openOverlay = useCallback((duration: number = 6000) => {
    setIsOverlayOpen(true);
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
    }
    overlayTimerRef.current = setTimeout(() => {
      setIsOverlayOpen(false);
    }, duration);
  }, []);

  const closeOverlay = useCallback(() => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
    setIsOverlayOpen(false);
  }, []);

  const resetOverlayTimer = useCallback(() => {
    openOverlay(6000);
  }, [openOverlay]);

  // Alterna Play / Pause do Player de TV ao Vivo
  const togglePlayPause = useCallback(() => {
    if (!player) return;
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn('Erro ao alternar reprodução:', e);
    }
  }, [player, isPlaying]);

  // Alterna proporção de tela do vídeo
  const toggleContentFit = useCallback(() => {
    setContentFit((prev) => {
      if (prev === 'contain') return 'cover';
      if (prev === 'cover') return 'fill';
      return 'contain';
    });
  }, []);

  // Load Channels for a Category
  const loadCategoryChannels = async (categoryId: string, preferredChannel?: LiveChannel) => {
    try {
      let list: LiveChannel[] = [];

      if (categoryId === 'favorites') {
        list = await storage.getFavoriteChannels();
      } else {
        list = await xtreamClient.getLiveStreams(categoryId);
      }

      setChannels(list);

      const targetChannel =
        preferredChannel && list.some((c) => String(c.stream_id) === String(preferredChannel.stream_id))
          ? preferredChannel
          : list[0] || null;

      if (targetChannel) {
        tuneChannel(targetChannel, true, true);
      }
    } catch (err) {
      console.error('Failed to load category channels:', err);
    }
  };

  // Tune into a Channel (Instant Video Stream Switch)
  const tuneChannel = useCallback(
    async (channel: LiveChannel, showBanner: boolean = true, forceReload: boolean = false) => {
      const currentChan = activeChannelRef.current || activeChannel;
      const isSameChannel = currentChan && String(currentChan.stream_id) === String(channel.stream_id);

      if (isSameChannel && !forceReload) {
        // Se for o mesmo canal que já está sendo assistido, NÃO recarrega o player de vídeo!
        if (showBanner) {
          openOverlay(4500);
        }
        return;
      }

      activeChannelRef.current = channel;
      setActiveChannel(channel);

      // Generate video stream URL
      const url = xtreamClient.getLiveStreamUrl(channel.stream_id, 'm3u8');
      setStreamUrl(url);

      if (player) {
        try {
          player.replace(url);
          player.play();
          setIsPlaying(true);
        } catch (e) {
          console.warn('Error replacing player stream:', e);
        }
      }

      // Persist as last watched
      storage.saveLastLiveChannel(channel);

      // Exibe overlay do canal sintonizado
      if (showBanner) {
        openOverlay(5000);
      } else {
        closeOverlay();
      }

      // Fetch EPG in background
      try {
        const fetchedEpg = await xtreamClient.getShortEpg(channel.stream_id);
        if (activeChannelRef.current?.stream_id === channel.stream_id) {
          setEpgList(fetchedEpg || []);
          if (fetchedEpg && fetchedEpg.length > 0) {
            setCurrentEpg(fetchedEpg[0]);
          } else {
            setCurrentEpg(null);
          }
        }
      } catch {
        if (activeChannelRef.current?.stream_id === channel.stream_id) {
          setEpgList([]);
          setCurrentEpg(null);
        }
      }
    },
    [player, activeChannel, openOverlay, closeOverlay]
  );

  // Handle D-Pad Zapping (Next / Previous Channel) - Percorre TODOS os canais da categoria
  const handleZapping = useCallback((direction: 'next' | 'prev') => {
    const channelList = channelsRef.current.length > 0 ? channelsRef.current : channels;
    const currentChan = activeChannelRef.current || activeChannel;
    if (!channelList || channelList.length === 0) return;

    let currentIndex = -1;
    if (currentChan) {
      currentIndex = channelList.findIndex(
        (c) =>
          String(c.stream_id) === String(currentChan.stream_id) ||
          Number(c.stream_id) === Number(currentChan.stream_id)
      );
    }

    let targetIndex = 0;
    if (currentIndex === -1) {
      targetIndex = 0;
    } else if (direction === 'next') {
      targetIndex = currentIndex >= channelList.length - 1 ? 0 : currentIndex + 1;
    } else {
      targetIndex = currentIndex <= 0 ? channelList.length - 1 : currentIndex - 1;
    }

    const nextChan = channelList[targetIndex];
    if (nextChan) {
      activeChannelRef.current = nextChan;
      tuneChannel(nextChan, true);
    }
  }, [channels, activeChannel, tuneChannel]);

  // Toggle Favorite Status
  const handleToggleFavorite = async (channel: LiveChannel) => {
    const isNowFav = await storage.toggleFavoriteChannel(channel);
    const updatedFavIds = await storage.getFavorites();
    setFavoriteIds(updatedFavIds);

    const updatedFavList = await storage.getFavoriteChannels();
    setFavoriteChannels(updatedFavList);

    // If currently viewing favorites and channel was removed, update list
    if (selectedCategory?.category_id === 'favorites') {
      setChannels(updatedFavList);
      if (activeChannel?.stream_id === channel.stream_id && updatedFavList.length > 0) {
        tuneChannel(updatedFavList[0], false);
      }
    }
  };

  // Back Button Handling (Remote Control)
  useEffect(() => {
    const onBackPress = () => {
      if (showExitDialog) {
        setShowExitDialog(false);
        return true;
      }
      // Se estiver no Guia de Canais e apertar Voltar, fecha o guia e volta ao overlay do vídeo
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        openOverlay(5000);
        return true;
      }
      // Se o overlay de controles estiver visível, fecha e assiste em tela cheia limpa
      if (isOverlayOpen) {
        closeOverlay();
        return true;
      }

      // Se já estiver em tela cheia e apertar Voltar, exibe diálogo para voltar ao menu principal
      setShowExitDialog(true);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isDrawerOpen, isOverlayOpen, showExitDialog, openOverlay, closeOverlay]);

  // Handle Category Select
  const handleCategorySelect = (cat: IptvCategory) => {
    setSelectedCategory(cat);
    loadCategoryChannels(cat.category_id);
  };

  // Handle Channel Select from Drawer: se for o mesmo canal não recarrega o vídeo; se for outro, troca
  const handleChannelSelect = (channel: LiveChannel) => {
    setIsDrawerOpen(false);
    const currentChan = activeChannelRef.current || activeChannel;
    if (currentChan && String(currentChan.stream_id) === String(channel.stream_id)) {
      // Já está assistindo este canal: NÃO recarrega o player de vídeo!
      openOverlay(4500);
      return;
    }
    tuneChannel(channel, true);
  };

  // Abre o Guia garantindo que a categoria e o canal ativo estejam selecionados
  const openChannelMenu = () => {
    closeOverlay();
    const currentChan = activeChannelRef.current || activeChannel;
    if (currentChan && currentChan.category_id && selectedCategory?.category_id !== currentChan.category_id) {
      const matchCat = categories.find((c) => String(c.category_id) === String(currentChan.category_id));
      if (matchCat) {
        setSelectedCategory(matchCat);
        loadCategoryChannels(matchCat.category_id, currentChan);
      }
    }
    setIsDrawerOpen(true);
  };

  // Garante que o foco sempre retorne para o centro ao fechar a gaveta ou diálogos
  useEffect(() => {
    if (!isDrawerOpen && !isOverlayOpen && !showExitDialog) {
      setTimeout(() => {
        centerFocusRef.current?.focus?.();
      }, 100);
    }
  }, [isDrawerOpen, isOverlayOpen, showExitDialog]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Conectando ao Guia de TV ao Vivo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Camada de Vídeo Contínuo em Tela Cheia (16:9 Landscape) */}
      <View style={StyleSheet.absoluteFill}>
        {streamUrl ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit={contentFit}
            nativeControls={false}
          />
        ) : (
          <View style={styles.blackBackground}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Sintonizando canal...</Text>
          </View>
        )}
      </View>

      {/* 2. Toque ou Tecla OK em Tela Cheia abre o Overlay do Player com controles */}
      {!isOverlayOpen && !isDrawerOpen && !showExitDialog && (
        <Pressable
          ref={centerFocusRef}
          focusable={true}
          hasTVPreferredFocus={true}
          onPress={() => openOverlay(6000)}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* 3. On-Screen Display (OSD): Overlay do Player & Gaveta de Canais */}
      <TVLiveOSD
        isDrawerOpen={isDrawerOpen}
        onCloseDrawer={() => {
          setIsDrawerOpen(false);
          openOverlay(5000);
        }}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
        channels={channels}
        activeChannel={activeChannel}
        onSelectChannel={handleChannelSelect}
        favoriteIds={favoriteIds}
        onToggleFavorite={handleToggleFavorite}
        isOverlayOpen={isOverlayOpen}
        onCloseOverlay={closeOverlay}
        currentEpg={currentEpg}
        epgList={epgList}
        onExitToHome={() => router.replace('/(tv)/home')}
        onPreviousChannel={() => handleZapping('prev')}
        onNextChannel={() => handleZapping('next')}
        onOpenDrawer={openChannelMenu}
        isPlaying={isPlaying}
        onTogglePlayPause={togglePlayPause}
        contentFit={contentFit}
        onToggleContentFit={toggleContentFit}
        onResetOverlayTimer={resetOverlayTimer}
      />

      {/* 4. Modal de Confirmação de Saída para o Menu Principal */}
      <Modal
        visible={showExitDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitDialog(false)}
      >
        <View style={styles.exitModalBackdrop}>
          <View style={styles.exitModalCard}>
            <View style={styles.exitModalIconContainer}>
              <Ionicons name="tv-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.exitModalTitle}>Deseja sair da TV ao Vivo?</Text>
            <Text style={styles.exitModalSubtitle}>
              O canal atual continuará pronto para retomar a qualquer momento.
            </Text>

            <View style={styles.exitModalActions}>
              <ModalActionButton
                label="Continuar Assistindo"
                isPrimary={false}
                hasPreferredFocus={true}
                onPress={() => setShowExitDialog(false)}
              />
              <ModalActionButton
                label="Sair para o Menu"
                isPrimary={true}
                onPress={() => {
                  setShowExitDialog(false);
                  router.replace('/(tv)/home');
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ModalActionButton({
  label,
  isPrimary,
  hasPreferredFocus,
  onPress,
}: {
  label: string;
  isPrimary: boolean;
  hasPreferredFocus?: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const isContinue = !isPrimary;

  let bg = '#1F1F28';
  let border = '#333340';
  let textColor = '#FFFFFF';

  if (isContinue) {
    // Continuar Assistindo: Branco sólido com anel de foco Cyan
    bg = '#FFFFFF';
    border = isFocused ? colors.primary : '#FFFFFF';
    textColor = '#000000';
  } else {
    // Sair para o Menu: Cyan no foco ou background escuro
    bg = isFocused ? colors.primary : '#1F1F28';
    border = isFocused ? '#FFFFFF' : '#333340';
    textColor = isFocused ? '#070A12' : '#FFFFFF';
  }

  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasPreferredFocus}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.exitModalBtnBase,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: isFocused ? 2.5 : 1.5,
        },
        isFocused && styles.exitBtnFocused,
      ]}
    >
      <Text
        style={[
          styles.exitModalBtnTextBase,
          {
            color: textColor,
            fontWeight: isFocused ? '900' : '700',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  blackBackground: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Exit Modal
  exitModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitModalCard: {
    width: 440,
    backgroundColor: '#121218',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#262630',
  },
  exitModalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 106, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  exitModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  exitModalSubtitle: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  exitModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  exitModalBtnBase: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitModalBtnTextBase: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  exitBtnFocused: {
    transform: [{ scale: 1.06 }],
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
});
