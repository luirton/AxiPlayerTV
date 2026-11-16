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
  const [isZappingBannerOpen, setIsZappingBannerOpen] = useState(false);
  const [currentEpg, setCurrentEpg] = useState<EpgProgram | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const zappingTimerRef = useRef<any>(null);

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

      // Restore last watched channel or fallback to first channel
      const lastChannel = await storage.getLastLiveChannel();
      let initialCategory = allCategories[0] || null;

      if (lastChannel && lastChannel.category_id) {
        const matchingCat = allCategories.find((c) => c.category_id === lastChannel.category_id);
        if (matchingCat) initialCategory = matchingCat;
      }

      setSelectedCategory(initialCategory);

      if (initialCategory) {
        await loadCategoryChannels(initialCategory.category_id, lastChannel || undefined);
      }
    } catch (err) {
      console.error('Failed to initialize Live TV:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
        preferredChannel && list.some((c) => c.stream_id === preferredChannel.stream_id)
          ? preferredChannel
          : list[0] || null;

      if (targetChannel) {
        tuneChannel(targetChannel);
      }
    } catch (err) {
      console.error('Failed to load category channels:', err);
    }
  };

  // Tune into a Channel (Instant Video Stream Switch)
  const tuneChannel = useCallback(
    async (channel: LiveChannel) => {
      setActiveChannel(channel);

      // Generate video stream URL
      const url = xtreamClient.getLiveStreamUrl(channel.stream_id, 'm3u8');
      setStreamUrl(url);

      if (player) {
        try {
          player.replace(url);
          player.play();
        } catch (e) {
          console.warn('Error replacing player stream:', e);
        }
      }

      // Persist as last watched
      storage.saveLastLiveChannel(channel);

      // Show Zapping Banner and auto-hide
      triggerZappingBanner();

      // Fetch EPG in background
      try {
        const epgList = await xtreamClient.getShortEpg(channel.stream_id);
        if (epgList && epgList.length > 0) {
          setCurrentEpg(epgList[0]);
        } else {
          setCurrentEpg(null);
        }
      } catch {
        setCurrentEpg(null);
      }
    },
    [player]
  );

  // Trigger Zapping Banner with 4.5s auto-hide timer
  const triggerZappingBanner = () => {
    setIsZappingBannerOpen(true);
    if (zappingTimerRef.current) {
      clearTimeout(zappingTimerRef.current);
    }
    zappingTimerRef.current = setTimeout(() => {
      setIsZappingBannerOpen(false);
    }, 4500);
  };

  // Handle D-Pad Zapping (Next / Previous Channel)
  const handleZapping = (direction: 'next' | 'prev') => {
    if (!channels || channels.length === 0 || !activeChannel) return;

    const currentIndex = channels.findIndex((c) => Number(c.stream_id) === Number(activeChannel.stream_id));
    let targetIndex = 0;

    if (direction === 'next') {
      targetIndex = currentIndex >= channels.length - 1 ? 0 : currentIndex + 1;
    } else {
      targetIndex = currentIndex <= 0 ? channels.length - 1 : currentIndex - 1;
    }

    const nextChan = channels[targetIndex];
    if (nextChan) {
      tuneChannel(nextChan);
    }
  };

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
        tuneChannel(updatedFavList[0]);
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
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return true;
      }
      if (isZappingBannerOpen) {
        setIsZappingBannerOpen(false);
        return true;
      }

      // In clean fullscreen: show exit prompt
      setShowExitDialog(true);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isDrawerOpen, isZappingBannerOpen, showExitDialog]);

  // Handle Category Select
  const handleCategorySelect = (cat: IptvCategory) => {
    setSelectedCategory(cat);
    loadCategoryChannels(cat.category_id);
  };

  // Handle Channel Select from Drawer
  const handleChannelSelect = (channel: LiveChannel) => {
    tuneChannel(channel);
    // Keep video playing and briefly display zapping bar
  };

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
            contentFit="contain"
            nativeControls={false}
          />
        ) : (
          <View style={styles.blackBackground}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Sintonizando canal...</Text>
          </View>
        )}
      </View>

      {/* 2. Área de Toque/Foco Invisível para Interação Remota no Vídeo */}
      {!isDrawerOpen && !showExitDialog && (
        <Pressable
          focusable={true}
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (isZappingBannerOpen) {
              setIsDrawerOpen(true);
              setIsZappingBannerOpen(false);
            } else {
              triggerZappingBanner();
            }
          }}
        >
          {/* Quick D-Pad Touch/Click Hotspots for testing */}
          <View style={styles.hotspotBar}>
            <HotspotAction icon="chevron-up" onPress={() => handleZapping('prev')} />
            <HotspotAction icon="list" onPress={() => setIsDrawerOpen(true)} />
            <HotspotAction icon="chevron-down" onPress={() => handleZapping('next')} />
          </View>
        </Pressable>
      )}

      {/* 3. On-Screen Display (OSD) Multicamadas: Gaveta Translúcida & Zapping */}
      <TVLiveOSD
        isDrawerOpen={isDrawerOpen}
        onCloseDrawer={() => setIsDrawerOpen(false)}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
        channels={channels}
        activeChannel={activeChannel}
        onSelectChannel={handleChannelSelect}
        favoriteIds={favoriteIds}
        onToggleFavorite={handleToggleFavorite}
        isZappingBannerOpen={isZappingBannerOpen}
        currentEpg={currentEpg}
        onExitToHome={() => router.replace('/(tv)/home')}
        onPreviousChannel={() => handleZapping('prev')}
        onNextChannel={() => handleZapping('next')}
        onOpenDrawer={() => {
          setIsZappingBannerOpen(false);
          setIsDrawerOpen(true);
        }}
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

function HotspotAction({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[styles.hotspotBtn, isFocused && styles.focusedBtn]}
    >
      <Ionicons name={icon} size={16} color="#AAA" />
    </Pressable>
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
  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasPreferredFocus}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        isPrimary ? styles.exitModalBtnPrimary : styles.exitModalBtnSecondary,
        isFocused && styles.exitBtnFocused,
      ]}
    >
      <Text
        style={
          isPrimary ? styles.exitModalBtnPrimaryText : styles.exitModalBtnSecondaryText
        }
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
  hotspotBar: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    gap: 8,
    opacity: 0.35,
  },
  hotspotBtn: {
    backgroundColor: 'rgba(20, 20, 25, 0.7)',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  focusedBtn: {
    borderColor: colors.focusRing,
    backgroundColor: colors.focusRing,
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
  exitModalBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1F1F28',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  exitModalBtnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  exitModalBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  exitModalBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  exitBtnFocused: {
    borderColor: colors.focusRing,
    transform: [{ scale: 1.04 }],
  },
});
