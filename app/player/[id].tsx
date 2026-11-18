import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  BackHandler,
  Platform,
  Modal,
  ScrollView,
  PanResponder,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';
import { findAlternativeMovieVersions, AlternativeMovieVersion } from '../../src/services/iptvVersions';

export default function TVPlayerScreen() {
  const router = useRouter();
  const {
    id,
    type = 'movie',
    name = 'Reprodução',
    container = 'mp4',
    icon = '',
  } = useLocalSearchParams<{
    id: string;
    type?: 'live' | 'movie' | 'series';
    name?: string;
    container?: string;
    icon?: string;
  }>();

  const isVod = type === 'movie' || type === 'series';

  // Video & Stream State
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);

  // Aspect ratio / Content fit ('contain' | 'cover' | 'fill')
  const [contentFit, setContentFit] = useState<'contain' | 'cover' | 'fill'>('contain');

  // Sliders: Volume (0 to 1) and Brightness (0.2 to 1)
  const [volume, setVolume] = useState<number>(1.0);
  const [brightness, setBrightness] = useState<number>(1.0);

  // Favorite State
  const [isFavorite, setIsFavorite] = useState<boolean>(false);

  // Seek Flash Feedback (+/- 10s)
  const [seekFlash, setSeekFlash] = useState<{
    visible: boolean;
    type: 'fwd' | 'rwd';
    label: string;
  }>({
    visible: false,
    type: 'fwd',
    label: '+10s',
  });
  const seekFlashTimerRef = useRef<any>(null);

  // Modals
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [showAudioModal, setShowAudioModal] = useState<boolean>(false);
  const [showSubtitleModal, setShowSubtitleModal] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Tracks State
  const [availableAudios, setAvailableAudios] = useState<any[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [availableSubtitles, setAvailableSubtitles] = useState<any[]>([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);

  // ID atual em reprodução (pode mudar se o usuário alternar para versão alternativa)
  const [currentPlayingId, setCurrentPlayingId] = useState<string>(id);

  // Estados para Arrastar o Progresso (Scrubber Dragging)
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPercent, setScrubPercent] = useState<number>(0);
  const [scrubDisplayTime, setScrubDisplayTime] = useState<number>(0);
  const trackLayoutRef = useRef<{ pageX: number; width: number }>({ pageX: 0, width: 1 });
  const trackRef = useRef<any>(null);

  // Estados para Detecção de Erro e Sugestão de Versão Alternativa
  const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
  const [suggestedNextVersion, setSuggestedNextVersion] = useState<AlternativeMovieVersion | null>(null);
  const [isSearchingNextVersion, setIsSearchingNextVersion] = useState<boolean>(false);
  const playbackFailureTriggeredRef = useRef<boolean>(false);
  const loadTimeoutRef = useRef<any>(null);

  const hideTimerRef = useRef<any>(null);
  const progressSaveTimerRef = useRef<any>(null);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  currentTimeRef.current = currentTime;
  durationRef.current = duration;

  // 1. Resolve Stream URL and Restore Last Saved Progress
  useEffect(() => {
    let isMounted = true;
    const resolveUrl = async () => {
      try {
        const profile = await storage.getActiveProfile();
        if (!profile) return;
        xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

        const url = xtreamClient.getStreamUrl(
          currentPlayingId,
          type as 'live' | 'movie' | 'series',
          container || 'mp4'
        );

        if (isMounted) {
          setStreamUrl(url);
        }

        // Check if favorite
        if (type === 'movie') {
          const favs = await storage.getMovieFavorites();
          if (isMounted) setIsFavorite(favs.includes(Number(currentPlayingId)));
        } else if (type === 'series') {
          const favs = await storage.getSeriesFavorites();
          if (isMounted) setIsFavorite(favs.includes(Number(currentPlayingId)));
        }

        // Restore saved progress for VOD
        if (isVod) {
          const progress = await storage.getWatchProgress(currentPlayingId);
          if (progress && progress.positionSec > 10 && progress.positionSec < (progress.durationSec - 30)) {
            setCurrentTime(progress.positionSec);
            if (progress.durationSec) setDuration(progress.durationSec);
          }
        }
      } catch (e) {
        console.warn('Erro ao resolver URL do player TV:', e);
      }
    };

    resolveUrl();
    return () => {
      isMounted = false;
    };
  }, [currentPlayingId, type, container, isVod]);

  // 2. Video Player Instance from expo-video
  const player = useVideoPlayer(streamUrl || '', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });

  // Handler de Falha de Reprodução e Busca de Próxima Versão
  const handlePlaybackFailure = useCallback(async () => {
    if (playbackFailureTriggeredRef.current) return;
    playbackFailureTriggeredRef.current = true;
    setIsBuffering(false);
    setIsSearchingNextVersion(true);
    setShowErrorModal(true);

    try {
      if (type === 'movie') {
        const alts = await findAlternativeMovieVersions(name, Number(currentPlayingId || id));
        if (alts && alts.length > 0) {
          setSuggestedNextVersion(alts[0]);
        } else {
          setSuggestedNextVersion(null);
        }
      } else {
        setSuggestedNextVersion(null);
      }
    } catch (e) {
      setSuggestedNextVersion(null);
    } finally {
      setIsSearchingNextVersion(false);
    }
  }, [name, currentPlayingId, id, type]);

  // Tentar Próxima Versão
  const handleTryNextVersion = () => {
    if (!suggestedNextVersion || !player) return;
    setShowErrorModal(false);
    setIsBuffering(true);
    playbackFailureTriggeredRef.current = false;
    const nextId = String(suggestedNextVersion.stream_id);
    setCurrentPlayingId(nextId);
    const newUrl = xtreamClient.getStreamUrl(
      nextId,
      'movie',
      suggestedNextVersion.container_extension || 'mp4'
    );
    setStreamUrl(newUrl);
    try {
      (player as any).replace?.(newUrl);
      player.play();
    } catch (e) {
      console.warn('Erro ao trocar stream:', e);
    }
  };

  // 3. Player Event Listeners
  useEffect(() => {
    if (!player) return;

    // Watchdog de 15 segundos: se o vídeo não iniciar, aciona verificação de versão alternativa
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      if (currentTimeRef.current <= 0) {
        handlePlaybackFailure();
      }
    }, 15000);

    const subPlayingChange = player.addListener('playingChange', (payload) => {
      setIsPlaying(payload.isPlaying);
    });

    const subStatusChange = player.addListener('statusChange', (payload) => {
      if (payload.status === 'readyToPlay') {
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        playbackFailureTriggeredRef.current = false;
        setShowErrorModal(false);
        setIsBuffering(false);
        const dur = player.duration || 0;
        if (dur > 0) setDuration(dur);

        // Resume saved progress if available
        if (currentTimeRef.current > 0 && Math.abs((player.currentTime || 0) - currentTimeRef.current) > 5) {
          try {
            player.currentTime = currentTimeRef.current;
          } catch (e) {}
        }
      } else if (payload.status === 'loading') {
        setIsBuffering(true);
      } else if (payload.status === 'error') {
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        setIsBuffering(false);
        handlePlaybackFailure();
      }
    });

    const subTimeUpdate = player.addListener('timeUpdate', (payload) => {
      if (payload.currentTime > 0) {
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      }
      setCurrentTime(payload.currentTime);
      if (player.duration && player.duration > 0) {
        setDuration(player.duration);
      }
    });

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      subPlayingChange.remove();
      subStatusChange.remove();
      subTimeUpdate.remove();
    };
  }, [player, handlePlaybackFailure]);

  // Funções de Arrastar o Progresso (Scrubber Dragging)
  const updateScrubFromPageX = (pageX: number) => {
    const { pageX: startX, width } = trackLayoutRef.current;
    if (width <= 0 || durationRef.current <= 0) return;
    const clampedX = Math.max(0, Math.min(width, pageX - startX));
    const pct = (clampedX / width) * 100;
    const targetSec = (clampedX / width) * durationRef.current;
    setScrubPercent(pct);
    setScrubDisplayTime(targetSec);
  };

  const commitScrub = (pageX: number) => {
    const { pageX: startX, width } = trackLayoutRef.current;
    if (width <= 0 || durationRef.current <= 0) {
      setIsScrubbing(false);
      return;
    }
    const clampedX = Math.max(0, Math.min(width, pageX - startX));
    const targetSec = Math.max(0, Math.min(durationRef.current, (clampedX / width) * durationRef.current));
    setIsScrubbing(false);
    if (player) {
      player.currentTime = targetSec;
      setCurrentTime(targetSec);
      saveCurrentProgress();
    }
    resetHideTimer();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsScrubbing(true);
        resetHideTimer();
        updateScrubFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt) => {
        resetHideTimer();
        updateScrubFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderRelease: (evt) => {
        commitScrub(evt.nativeEvent.pageX);
      },
      onPanResponderTerminate: () => {
        setIsScrubbing(false);
      },
    })
  ).current;

  // 4. Salva Progresso Periodicamente (a cada 10 segundos para VOD)
  const saveCurrentProgress = useCallback(async () => {
    if (!isVod || durationRef.current <= 30) return;
    try {
      await storage.saveWatchProgress({
        id: String(id),
        title: name || 'Título',
        poster: icon || undefined,
        type: type as 'movie' | 'series',
        positionSec: Math.floor(currentTimeRef.current),
        durationSec: Math.floor(durationRef.current),
        extension: container || 'mp4',
        timestamp: Date.now(),
      });
    } catch (e) {}
  }, [id, name, icon, type, container, isVod]);

  useEffect(() => {
    if (!isVod) return;
    progressSaveTimerRef.current = setInterval(() => {
      saveCurrentProgress();
    }, 10000);

    return () => {
      if (progressSaveTimerRef.current) clearInterval(progressSaveTimerRef.current);
      saveCurrentProgress();
    };
  }, [isVod, saveCurrentProgress]);

  // 5. Timer de Auto-Hide dos Controles (5 segundos de inatividade)
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5500);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // 6. Controles de Reprodução e Seek (+/- 10s)
  const togglePlayPause = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      saveCurrentProgress();
    } else {
      player.play();
      setIsPlaying(true);
    }
    resetHideTimer();
  };

  const handleSeek = (offsetSec: number) => {
    if (!player || duration <= 0) return;
    const target = Math.max(0, Math.min(duration, (player.currentTime || 0) + offsetSec));
    player.currentTime = target;
    setCurrentTime(target);

    setSeekFlash({
      visible: true,
      type: offsetSec > 0 ? 'fwd' : 'rwd',
      label: offsetSec > 0 ? `+${offsetSec}s` : `${offsetSec}s`,
    });

    if (seekFlashTimerRef.current) clearTimeout(seekFlashTimerRef.current);
    seekFlashTimerRef.current = setTimeout(() => {
      setSeekFlash((prev) => ({ ...prev, visible: false }));
    }, 1000);

    resetHideTimer();
  };

  // Toggle Aspect Ratio
  const handleToggleContentFit = () => {
    setContentFit((prev) => {
      if (prev === 'contain') return 'cover';
      if (prev === 'cover') return 'fill';
      return 'contain';
    });
    resetHideTimer();
  };

  // Toggle Favorite
  const handleToggleFavorite = async () => {
    if (type === 'movie') {
      await storage.toggleFavoriteMovie({
        stream_id: Number(id),
        name,
        stream_icon: icon,
        container_extension: container || 'mp4',
      } as any);
      setIsFavorite((prev) => !prev);
    } else if (type === 'series') {
      await storage.toggleFavoriteSeries({
        series_id: Number(id),
        name,
        cover: icon,
      } as any);
      setIsFavorite((prev) => !prev);
    }
    resetHideTimer();
  };

  // Adjust Volume
  const handleAdjustVolume = (delta: number) => {
    setVolume((prev) => {
      const next = Math.max(0, Math.min(1.0, prev + delta));
      try {
        if (player) player.volume = next;
      } catch (e) {}
      return next;
    });
    resetHideTimer();
  };

  // Adjust Brightness
  const handleAdjustBrightness = (delta: number) => {
    setBrightness((prev) => Math.max(0.2, Math.min(1.0, prev + delta)));
    resetHideTimer();
  };

  // 7. Mapeamento da Tecla Back do Controle Remoto
  useEffect(() => {
    const onBackPress = () => {
      if (showInfoModal) {
        setShowInfoModal(false);
        return true;
      }
      if (showAudioModal) {
        setShowAudioModal(false);
        return true;
      }
      if (showSubtitleModal) {
        setShowSubtitleModal(false);
        return true;
      }
      if (showExitConfirm) {
        setShowExitConfirm(false);
        return true;
      }
      if (showControls) {
        setShowControls(false);
        return true;
      }
      // Se controles já ocultos, exibe diálogo de saída
      setShowExitConfirm(true);
      return true;
    };

    const handler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => handler.remove();
  }, [showControls, showExitConfirm, showAudioModal, showSubtitleModal, showInfoModal]);

  const handleExitAndSave = async () => {
    await saveCurrentProgress();
    setShowExitConfirm(false);
    router.back();
  };

  // Formatação de Segundos para HH:MM:SS
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* 1. Camada de Vídeo (expo-video) */}
      {streamUrl ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          nativeControls={false}
        />
      ) : null}

      {/* Camada de ajuste de brilho simulado */}
      {brightness < 1.0 && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(0,0,0,${(1 - brightness).toFixed(2)})` },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Buffering Indicator */}
      {isBuffering && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.bufferingText}>Carregando transmissão...</Text>
        </View>
      )}

      {/* Seek Flash Banner (+10s ou -10s com glow neon) */}
      {seekFlash.visible && (
        <View style={styles.seekFlashContainer} pointerEvents="none">
          <View style={styles.seekFlashBox}>
            <Ionicons
              name={seekFlash.type === 'fwd' ? 'play-forward' : 'play-back'}
              size={36}
              color={colors.primary}
            />
            <Text style={styles.seekFlashText}>{seekFlash.label}</Text>
          </View>
        </View>
      )}

      {/* Área invisível que reabre os controles ao clicar quando ocultos */}
      {!showControls && (
        <Pressable
          focusable={true}
          hasTVPreferredFocus={true}
          onPress={resetHideTimer}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* ============================================================== */}
      {/* ON-SCREEN DISPLAY (OSD) COMPLETO - PADRÃO IMAGEM 9             */}
      {/* ============================================================== */}
      {showControls && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* 1. Barra Superior (Imagem 9): Voltar, Título Centralizado, Ícones de Ação */}
          <LinearGradient
            colors={['rgba(5, 5, 10, 0.95)', 'rgba(5, 5, 10, 0.6)', 'transparent']}
            style={styles.topBar}
          >
            {/* Botão Voltar (Esquerda) */}
            <TVPlayerIconButton
              icon="arrow-back"
              size={24}
              onPress={() => setShowExitConfirm(true)}
            />

            {/* Título Centralizado (Centro) */}
            <View style={styles.topCenterTitleBox}>
              <Text style={styles.topCenterTitle} numberOfLines={1}>
                {name}
              </Text>
            </View>

            {/* Grupo de 5 Ícones (Direita): Info, Heart, Subtitle, Audio, AspectRatio */}
            <View style={styles.topRightIconsGroup}>
              {/* Info (i) */}
              <TVPlayerIconButton
                icon="information-circle-outline"
                size={22}
                onPress={() => setShowInfoModal(true)}
              />

              {/* Heart (Favorito) */}
              <TVPlayerIconButton
                icon={isFavorite ? 'heart' : 'heart-outline'}
                iconColor={isFavorite ? '#FF3B30' : '#FFFFFF'}
                size={22}
                onPress={handleToggleFavorite}
              />

              {/* Subtitles (Legendas) */}
              <TVPlayerIconButton
                icon="card-outline"
                size={22}
                onPress={() => setShowSubtitleModal(true)}
              />

              {/* Audio Tracks */}
              <TVPlayerIconButton
                icon="musical-note-outline"
                size={22}
                onPress={() => setShowAudioModal(true)}
              />

              {/* Aspect Ratio / Fullscreen */}
              <TVPlayerIconButton
                icon="scan-outline"
                size={22}
                onPress={handleToggleContentFit}
              />
            </View>
          </LinearGradient>

          {/* 2. Barra Lateral Esquerda: Slider Vertical de Brilho (Imagem 9) */}
          <View style={styles.leftSliderContainer} pointerEvents="box-none">
            <Pressable
              focusable={true}
              onPress={() => handleAdjustBrightness(brightness >= 0.9 ? -0.4 : 0.2)}
              style={({ focused }: any) => [
                styles.sliderTrackWrapper,
                focused && styles.sliderFocused,
              ]}
            >
              <Ionicons name="sunny-outline" size={20} color="#FFFFFF" style={styles.sliderIcon} />
              <View style={styles.verticalTrackBg}>
                <View
                  style={[
                    styles.verticalTrackFill,
                    { height: `${Math.round(brightness * 100)}%` },
                  ]}
                />
                <View
                  style={[
                    styles.verticalThumb,
                    { bottom: `${Math.max(0, Math.min(94, Math.round(brightness * 100) - 6))}%` },
                  ]}
                />
              </View>
            </Pressable>
          </View>

          {/* 3. Barra Lateral Direita: Slider Vertical de Volume (Imagem 9) */}
          <View style={styles.rightSliderContainer} pointerEvents="box-none">
            <Pressable
              focusable={true}
              onPress={() => handleAdjustVolume(volume >= 0.9 ? -0.4 : 0.2)}
              style={({ focused }: any) => [
                styles.sliderTrackWrapper,
                focused && styles.sliderFocused,
              ]}
            >
              <Ionicons name="volume-high-outline" size={20} color="#FFFFFF" style={styles.sliderIcon} />
              <View style={styles.verticalTrackBg}>
                <View
                  style={[
                    styles.verticalTrackFill,
                    { height: `${Math.round(volume * 100)}%` },
                  ]}
                />
                <View
                  style={[
                    styles.verticalThumb,
                    { bottom: `${Math.max(0, Math.min(94, Math.round(volume * 100) - 6))}%` },
                  ]}
                />
              </View>
            </Pressable>
          </View>

          {/* 4. Controles Centrais (Imagem 9): -10s, Play/Pause Central Gigante, +10s */}
          <View style={styles.centerControlsContainer} pointerEvents="box-none">
            {isVod && (
              <TVPlayerCircularBtn
                icon="refresh"
                badgeText="10"
                isCounterClockwise={true}
                onPress={() => handleSeek(-10)}
              />
            )}

            {/* Central Play/Pause Button (Preferred Focus) */}
            <Pressable
              focusable={true}
              hasTVPreferredFocus={true}
              onPress={togglePlayPause}
              style={({ focused }: any) => [
                styles.mainPlayPauseBtn,
                focused && styles.mainPlayPauseBtnFocused,
              ]}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={48}
                color="#FFFFFF"
              />
            </Pressable>

            {isVod && (
              <TVPlayerCircularBtn
                icon="refresh"
                badgeText="10"
                isCounterClockwise={false}
                onPress={() => handleSeek(10)}
              />
            )}
          </View>

          {/* 5. Barra Inferior (Imagem 9): Tempo Decorrido, Scrubber Seekbar, Tempo Total */}
          <LinearGradient
            colors={['transparent', 'rgba(5, 5, 10, 0.7)', 'rgba(5, 5, 10, 0.95)']}
            style={styles.bottomBar}
          >
            <View style={styles.timelineRow}>
              {/* Tempo Decorrido */}
              <Text style={styles.timeLabel}>
                {formatTime(isScrubbing ? scrubDisplayTime : currentTime)}
              </Text>

              {/* Scrubber / Seekbar Interativo com Suporte a Arrastar (Drag) */}
              <View
                ref={trackRef}
                collapsable={false}
                onLayout={(e) => {
                  const { width } = e.nativeEvent.layout;
                  if (width > 0) {
                    trackLayoutRef.current.width = width;
                  }
                  trackRef.current?.measure?.((_x: number, _y: number, w: number, _h: number, pageX: number) => {
                    if (w > 0) {
                      trackLayoutRef.current = { pageX, width: w };
                    }
                  });
                }}
                {...panResponder.panHandlers}
                style={styles.timelineInteractiveTrack}
              >
                <Pressable
                  focusable={true}
                  onPress={() => handleSeek(15)}
                  style={({ focused }: any) => [
                    styles.timelinePressableInner,
                    focused && styles.timelineFocused,
                  ]}
                >
                  <View style={styles.timelineBarBg}>
                    <View
                      style={[
                        styles.timelineBarFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.max(0, isScrubbing ? scrubPercent : progressPercent)
                          )}%`,
                        },
                      ]}
                    />
                    {/* Circular Blue Thumb (Padrão Imagem 9) */}
                    <View
                      style={[
                        styles.timelineThumb,
                        {
                          left: `${Math.max(
                            0,
                            Math.min(
                              98,
                              isScrubbing ? scrubPercent : progressPercent
                            )
                          )}%`,
                        },
                        isScrubbing && styles.timelineThumbDragging,
                      ]}
                    />

                    {/* Tooltip com Tempo Flutuante ao Arrastar */}
                    {isScrubbing && (
                      <View
                        style={[
                          styles.scrubBubble,
                          {
                            left: `${Math.max(
                              4,
                              Math.min(92, scrubPercent)
                            )}%`,
                          },
                        ]}
                      >
                        <Text style={styles.scrubBubbleText}>
                          {formatTime(scrubDisplayTime)}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </View>

              {/* Tempo Total */}
              <Text style={styles.timeLabel}>{formatTime(duration)}</Text>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Modal: Informações do Vídeo (i) */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.infoModalCard}>
            <View style={styles.trackModalHeader}>
              <Ionicons name="information-circle" size={24} color={colors.primary} />
              <Text style={styles.trackModalTitle}>Detalhes da Reprodução</Text>
            </View>
            <Text style={styles.infoTitle}>{name}</Text>
            <Text style={styles.infoMeta}>
              Formato: {container?.toUpperCase() || 'MP4'} • Engine: ExoPlayer Hardware
            </Text>
            <Text style={styles.infoMeta}>
              Posição: {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
            <Text style={styles.infoMeta}>
              Ajuste de Tela: {contentFit.toUpperCase()} • Brilho: {Math.round(brightness * 100)}% • Volume: {Math.round(volume * 100)}%
            </Text>

            <Pressable
              focusable={true}
              hasTVPreferredFocus={true}
              onPress={() => setShowInfoModal(false)}
              style={({ focused }: any) => [
                styles.closeTrackBtn,
                focused && styles.dialogBtnFocused,
              ]}
            >
              <Text style={styles.closeTrackBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Confirmação de Saída com Posição Salva */}
      <Modal
        visible={showExitConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitConfirm(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.exitModalCard}>
            <Ionicons name="play-circle-outline" size={44} color={colors.primary} />
            <Text style={styles.modalTitle}>Deseja sair da reprodução?</Text>
            {isVod && (
              <Text style={styles.modalSubtitle}>
                Sua posição ({formatTime(currentTime)} de {formatTime(duration)}) será salva automaticamente para você continuar de onde parou.
              </Text>
            )}

            <View style={styles.modalActionsRow}>
              {/* Continuar Assistindo (Branco Sólido - Imagem 1) */}
              <Pressable
                focusable={true}
                hasTVPreferredFocus={true}
                onPress={() => setShowExitConfirm(false)}
                style={({ focused }: any) => [
                  styles.dialogBtn,
                  styles.dialogBtnContinue,
                  focused && styles.dialogBtnContinueFocused,
                ]}
              >
                <Text style={styles.dialogBtnContinueText}>Continuar Assistindo</Text>
              </Pressable>

              {/* Salvar e Sair */}
              <Pressable
                focusable={true}
                onPress={handleExitAndSave}
                style={({ focused }: any) => [
                  styles.dialogBtn,
                  styles.dialogBtnSecondary,
                  focused && styles.dialogBtnFocused,
                ]}
              >
                <Text style={styles.dialogBtnSecondaryText}>
                  Salvar e Sair
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Falha no Carregamento & Sugestão de Versão Alternativa / Não Disponível */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => router.back()}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.errorModalCard}>
            <Ionicons
              name={suggestedNextVersion ? 'swap-horizontal' : 'alert-circle-outline'}
              size={44}
              color={colors.primary}
            />

            <Text style={styles.errorModalTitle}>
              {suggestedNextVersion
                ? 'Falha ao carregar transmissão'
                : 'Conteúdo Indisponível'}
            </Text>

            {isSearchingNextVersion ? (
              <View style={styles.errorLoadingBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.errorModalSubtitle}>
                  Verificando outras versões disponíveis deste título na sua lista...
                </Text>
              </View>
            ) : suggestedNextVersion ? (
              <>
                <Text style={styles.errorModalSubtitle}>
                  Esta versão de "{name}" não pôde ser reproduzida no momento. Encontramos outra versão na sua lista:
                </Text>

                <View style={styles.suggestedVersionBox}>
                  <Ionicons name="film-outline" size={22} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestedVersionName} numberOfLines={1}>
                      {suggestedNextVersion.name}
                    </Text>
                    <Text style={styles.suggestedVersionCat}>
                      {suggestedNextVersion.category_name} • {suggestedNextVersion.container_extension.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActionsRow}>
                  {/* Tentar Próxima Versão (Branco Sólido de Alta Visibilidade) */}
                  <Pressable
                    focusable={true}
                    hasTVPreferredFocus={true}
                    onPress={handleTryNextVersion}
                    style={({ focused }: any) => [
                      styles.dialogBtn,
                      styles.dialogBtnContinue,
                      focused && styles.dialogBtnContinueFocused,
                    ]}
                  >
                    <Ionicons name="play" size={16} color="#000000" style={{ marginRight: 6 }} />
                    <Text style={styles.dialogBtnContinueText}>
                      Tentar Próxima Versão
                    </Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => router.back()}
                    style={({ focused }: any) => [
                      styles.dialogBtn,
                      styles.dialogBtnSecondary,
                      focused && styles.dialogBtnFocused,
                    ]}
                  >
                    <Text style={styles.dialogBtnSecondaryText}>Voltar ao Catálogo</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.errorModalSubtitle}>
                  Não foi possível reproduzir este filme e nenhuma versão alternativa foi encontrada na sua lista IPTV no momento. Tente novamente mais tarde.
                </Text>

                <View style={[styles.modalActionsRow, { justifyContent: 'center' }]}>
                  <Pressable
                    focusable={true}
                    hasTVPreferredFocus={true}
                    onPress={() => router.back()}
                    style={({ focused }: any) => [
                      styles.dialogBtn,
                      styles.dialogBtnContinue,
                      focused && styles.dialogBtnContinueFocused,
                      { maxWidth: 220 },
                    ]}
                  >
                    <Text style={styles.dialogBtnContinueText}>Voltar ao Catálogo</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Seletor de Trilhas de Áudio */}
      <Modal
        visible={showAudioModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAudioModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.trackModalCard}>
            <View style={styles.trackModalHeader}>
              <Ionicons name="volume-high" size={20} color={colors.primary} />
              <Text style={styles.trackModalTitle}>Trilhas de Áudio</Text>
            </View>

            <ScrollView style={styles.trackList}>
              {availableAudios.length > 0 ? (
                availableAudios.map((audio: any, idx: number) => {
                  const isSelected = selectedAudioId === (audio.id || String(idx));
                  return (
                    <Pressable
                      key={idx}
                      focusable={true}
                      hasTVPreferredFocus={idx === 0}
                      onPress={() => {
                        try {
                          (player as any).currentAudioTrack = audio;
                          setSelectedAudioId(audio.id || String(idx));
                        } catch (e) {}
                        setShowAudioModal(false);
                      }}
                      style={({ focused }: any) => [
                        styles.trackItem,
                        isSelected && styles.trackItemSelected,
                        focused && styles.trackItemFocused,
                      ]}
                    >
                      <Text style={styles.trackItemText}>
                        {audio.label || audio.language || `Faixa ${idx + 1}`}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.emptyTrackText}>
                  Áudio padrão nativo do stream IPTV (Estéreo / Multicanal 5.1).
                </Text>
              )}
            </ScrollView>

            <Pressable
              focusable={true}
              onPress={() => setShowAudioModal(false)}
              style={({ focused }: any) => [
                styles.closeTrackBtn,
                focused && styles.dialogBtnFocused,
              ]}
            >
              <Text style={styles.closeTrackBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Seletor de Legendas */}
      <Modal
        visible={showSubtitleModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSubtitleModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.trackModalCard}>
            <View style={styles.trackModalHeader}>
              <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
              <Text style={styles.trackModalTitle}>Legendas</Text>
            </View>

            <ScrollView style={styles.trackList}>
              <Pressable
                focusable={true}
                hasTVPreferredFocus={selectedSubtitleId === null}
                onPress={() => {
                  try {
                    (player as any).currentSubtitleTrack = null;
                  } catch (e) {}
                  setSelectedSubtitleId(null);
                  setShowSubtitleModal(false);
                }}
                style={({ focused }: any) => [
                  styles.trackItem,
                  selectedSubtitleId === null && styles.trackItemSelected,
                  focused && styles.trackItemFocused,
                ]}
              >
                <Text style={styles.trackItemText}>Desativar Legendas</Text>
                {selectedSubtitleId === null && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                )}
              </Pressable>

              {availableSubtitles.map((sub: any, idx: number) => {
                const isSelected = selectedSubtitleId === (sub.id || String(idx));
                return (
                  <Pressable
                    key={idx}
                    focusable={true}
                    onPress={() => {
                      try {
                        (player as any).currentSubtitleTrack = sub;
                        setSelectedSubtitleId(sub.id || String(idx));
                      } catch (e) {}
                      setShowSubtitleModal(false);
                    }}
                    style={({ focused }: any) => [
                      styles.trackItem,
                      isSelected && styles.trackItemSelected,
                      focused && styles.trackItemFocused,
                    ]}
                  >
                    <Text style={styles.trackItemText}>
                      {sub.label || sub.language || `Legenda ${idx + 1}`}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              focusable={true}
              onPress={() => setShowSubtitleModal(false)}
              style={({ focused }: any) => [
                styles.closeTrackBtn,
                focused && styles.dialogBtnFocused,
              ]}
            >
              <Text style={styles.closeTrackBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Botão Circular com Ícone para a Barra Superior
function TVPlayerIconButton({
  icon,
  iconColor = '#FFFFFF',
  size = 22,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  size?: number;
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
        styles.iconButton,
        isFocused && styles.iconButtonFocused,
      ]}
    >
      <Ionicons name={icon} size={size} color={isFocused ? colors.primary : iconColor} />
    </Pressable>
  );
}

// Botão Circular de Seek Central (+10s / -10s com ícone circular - Imagem 9)
function TVPlayerCircularBtn({
  icon,
  badgeText,
  isCounterClockwise,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  badgeText: string;
  isCounterClockwise: boolean;
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
        styles.seekCircleBtn,
        isFocused && styles.seekCircleBtnFocused,
      ]}
    >
      <Ionicons
        name={icon}
        size={36}
        color={isFocused ? colors.primary : '#FFFFFF'}
        style={isCounterClockwise ? { transform: [{ scaleX: -1 }] } : undefined}
      />
      <Text style={[styles.seekCircleBadgeText, isFocused && { color: colors.primary }]}>
        {badgeText}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  bufferingText: {
    color: '#E0E0E0',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
  },
  seekFlashContainer: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    zIndex: 30,
  },
  seekFlashBox: {
    backgroundColor: 'rgba(5, 5, 10, 0.9)',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  seekFlashText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginLeft: 10,
  },

  /* 1. Top Bar (Imagem 9) */
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  topCenterTitleBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  topCenterTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topRightIconsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  iconButtonFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
    transform: [{ scale: 1.15 }],
  },

  /* 2 & 3. Vertical Sliders (Left: Brightness, Right: Volume - Imagem 9) */
  leftSliderContainer: {
    position: 'absolute',
    left: 36,
    top: '25%',
    bottom: '25%',
    width: 44,
    alignItems: 'center',
    zIndex: 10,
  },
  rightSliderContainer: {
    position: 'absolute',
    right: 36,
    top: '25%',
    bottom: '25%',
    width: 44,
    alignItems: 'center',
    zIndex: 10,
  },
  sliderTrackWrapper: {
    flex: 1,
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sliderFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
  },
  sliderIcon: {
    marginBottom: 10,
  },
  verticalTrackBg: {
    flex: 1,
    width: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  verticalTrackFill: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  verticalThumb: {
    position: 'absolute',
    left: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#00B4D8',
  },

  /* 4. Center Controls (Imagem 9: -10s, Play/Pause, +10s) */
  centerControlsContainer: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    zIndex: 10,
  },
  mainPlayPauseBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  mainPlayPauseBtnFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
    transform: [{ scale: 1.15 }],
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  seekCircleBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  seekCircleBtnFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
    transform: [{ scale: 1.15 }],
  },
  seekCircleBadgeText: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  /* 5. Bottom Bar (Imagem 9) */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: 20,
    paddingTop: 16,
    zIndex: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timeLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 50,
  },
  timelineInteractiveTrack: {
    flex: 1,
    height: 38,
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  timelinePressableInner: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  timelineFocused: {
    borderColor: colors.primary,
  },
  timelineBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  timelineBarFill: {
    height: '100%',
    backgroundColor: colors.primary, // #00E5FF (Cores do sistema)
    borderRadius: 3,
  },
  timelineThumb: {
    position: 'absolute',
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary, // Blue circular thumb (Imagem 9)
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  timelineThumbDragging: {
    transform: [{ scale: 1.4 }],
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
  },
  scrubBubble: {
    position: 'absolute',
    bottom: 24,
    transform: [{ translateX: -30 }],
    backgroundColor: 'rgba(7, 10, 18, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    minWidth: 60,
    alignItems: 'center',
    zIndex: 30,
  },
  scrubBubbleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  exitModalCard: {
    width: 460,
    backgroundColor: '#0E1322',
    borderRadius: 16,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 22,
    width: '100%',
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
  },
  dialogBtnContinue: {
    backgroundColor: '#FFFFFF', // Branco Sólido (Imagem 1)
    borderColor: '#FFFFFF',
  },
  dialogBtnContinueFocused: {
    borderColor: colors.primary, // #00E5FF
    backgroundColor: '#FFFFFF',
    transform: [{ scale: 1.06 }],
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  dialogBtnContinueText: {
    color: '#000000', // Preto sobre branco
    fontSize: 13,
    fontWeight: '900',
  },
  dialogBtnSecondary: {
    backgroundColor: '#1E2845',
    borderWidth: 1.5,
    borderColor: '#2A365B',
  },
  dialogBtnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dialogBtnPrimary: {
    backgroundColor: colors.primary,
  },
  dialogBtnFocused: {
    borderColor: colors.primary,
    transform: [{ scale: 1.05 }],
  },
  dialogBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Error & Alternative Version Modal */
  errorModalCard: {
    width: 480,
    backgroundColor: '#0E1322',
    borderRadius: 16,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  errorModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorModalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  suggestedVersionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#151C30',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: 18,
    gap: 12,
  },
  suggestedVersionName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  suggestedVersionCat: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  /* Track & Info Modals */
  trackModalCard: {
    width: 380,
    maxHeight: '80%',
    backgroundColor: '#0E1322',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  infoModalCard: {
    width: 440,
    backgroundColor: '#0E1322',
    borderRadius: 14,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  infoMeta: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  trackModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  trackModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackList: {
    maxHeight: 220,
    marginBottom: 16,
  },
  trackItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#151C30',
    marginVertical: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  trackItemSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
  },
  trackItemFocused: {
    borderColor: colors.primary,
    transform: [{ scale: 1.03 }],
  },
  trackItemText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyTrackText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
  closeTrackBtn: {
    backgroundColor: '#151C30',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#1E2845',
  },
  closeTrackBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
