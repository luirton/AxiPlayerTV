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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';

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

  // Tracks State
  const [availableAudios, setAvailableAudios] = useState<any[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [availableSubtitles, setAvailableSubtitles] = useState<any[]>([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);

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
          id,
          type as 'live' | 'movie' | 'series',
          container || 'mp4'
        );

        if (isMounted) {
          setStreamUrl(url);
        }

        // Se for VOD, restaura progresso salvo anteriormente
        if (isVod) {
          const progress = await storage.getWatchProgress(id);
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
  }, [id, type, container]);

  // 2. Video Player Instance from expo-video
  const player = useVideoPlayer(streamUrl || '', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });

  // 3. Register Player Events (timeUpdate, statusChange, playingChange)
  useEffect(() => {
    if (!player) return;

    const playingSub = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
      if (event.isPlaying) setIsBuffering(false);
    });

    const timeSub = player.addListener('timeUpdate', (event) => {
      if (event.currentTime > 0) setIsBuffering(false);
      setCurrentTime(event.currentTime);
      if (player.duration > 0) {
        setDuration(player.duration);
      }
    });

    const statusSub = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setIsBuffering(false);
        // Atualiza trilhas disponíveis de áudio e legenda
        try {
          if (player.availableAudioTracks && player.availableAudioTracks.length > 0) {
            setAvailableAudios(player.availableAudioTracks);
          }
          if (player.availableSubtitleTracks && player.availableSubtitleTracks.length > 0) {
            setAvailableSubtitles(player.availableSubtitleTracks);
          }
        } catch (e) {}

        // Se tínhamos posição salva e o vídeo acabou de abrir, busca para a posição
        if (currentTimeRef.current > 10 && player.currentTime < 5) {
          player.currentTime = currentTimeRef.current;
        }
      } else if (event.status === 'loading') {
        setIsBuffering(true);
      }
    });

    return () => {
      playingSub.remove();
      timeSub.remove();
      statusSub.remove();
    };
  }, [player]);

  // 4. Salvar progresso de reprodução periodicamente
  const saveCurrentProgress = useCallback(async () => {
    if (!isVod || currentTimeRef.current <= 5) return;
    try {
      await storage.saveWatchProgress({
        id: String(id),
        title: name || 'Vídeo',
        poster: icon || undefined,
        type: type === 'series' ? 'series' : 'movie',
        positionSec: Math.floor(currentTimeRef.current),
        durationSec: Math.floor(durationRef.current || 0),
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

  // 5. Timer de Auto-Hide dos Controles (4 segundos de inatividade)
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
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

  // 7. Mapeamento da Tecla Back do Controle Remoto
  useEffect(() => {
    const onBackPress = () => {
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
        return true; // Oculta o OSD sem parar a reprodução
      }
      // Se o OSD já estava oculto, exibe diálogo de saída
      setShowExitConfirm(true);
      return true;
    };

    const handler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => handler.remove();
  }, [showControls, showExitConfirm, showAudioModal, showSubtitleModal]);

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
    <Pressable
      style={styles.container}
      onPress={resetHideTimer}
      focusable={true}
    >
      {/* Video View Layer */}
      {streamUrl ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
        />
      ) : null}

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

      {/* On-Screen Display (OSD) Overlay */}
      {showControls && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Top Bar OSD */}
          <LinearGradient
            colors={['rgba(7, 10, 18, 0.95)', 'rgba(7, 10, 18, 0.4)', 'transparent']}
            style={styles.topBar}
          >
            <Pressable
              focusable={true}
              onPress={() => setShowExitConfirm(true)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>

            <View style={styles.titleContainer}>
              <Text style={styles.streamTitle} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {type === 'live' ? 'AO VIVO' : 'VOD 1080P'}
                  </Text>
                </View>
                <Text style={styles.streamServer}>ExoPlayer HW • {container?.toUpperCase() || 'MP4'}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Bottom Bar OSD: Progress Bar & Remote Controls */}
          <LinearGradient
            colors={['transparent', 'rgba(7, 10, 18, 0.6)', 'rgba(7, 10, 18, 0.96)']}
            style={styles.bottomBar}
          >
            {/* VOD Timeline Scrubber */}
            {isVod && duration > 0 ? (
              <View style={styles.timelineWrapper}>
                <View style={styles.timelineBarBg}>
                  <View style={[styles.timelineBarFill, { width: `${Math.min(progressPercent, 100)}%` }]} />
                </View>
                <View style={styles.timeLabelsRow}>
                  <Text style={styles.timeLabel}>{formatTime(currentTime)}</Text>
                  <Text style={styles.timeLabel}>{formatTime(duration)}</Text>
                </View>
              </View>
            ) : null}

            {/* D-Pad Focusable Control Buttons */}
            <View style={styles.controlsRow}>
              {isVod && (
                <TVControlBtn
                  icon="play-back"
                  label="-10s"
                  onPress={() => handleSeek(-10)}
                />
              )}

              <Pressable
                focusable={true}
                hasTVPreferredFocus={true}
                onPress={togglePlayPause}
                style={({ focused }: any) => [
                  styles.playPauseBtn,
                  focused && styles.playPauseBtnFocused,
                ]}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={32}
                  color="#070A12"
                />
              </Pressable>

              {isVod && (
                <TVControlBtn
                  icon="play-forward"
                  label="+10s"
                  onPress={() => handleSeek(10)}
                />
              )}

              <TVControlBtn
                icon="volume-high-outline"
                label="Áudio"
                onPress={() => {
                  setShowControls(false);
                  setShowAudioModal(true);
                }}
              />

              <TVControlBtn
                icon="chatbubble-ellipses-outline"
                label="Legendas"
                onPress={() => {
                  setShowControls(false);
                  setShowSubtitleModal(true);
                }}
              />

              <TVControlBtn
                icon="eye-off-outline"
                label="Ocultar"
                onPress={() => setShowControls(false)}
              />
            </View>

            <Text style={styles.remoteHint}>
              💡 D-Pad ◀ / ▶: Retroceder/Avançar 10s • OK: Play/Pause • Voltar: Sair/Ocultar
            </Text>
          </LinearGradient>
        </View>
      )}

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
              <Pressable
                focusable={true}
                hasTVPreferredFocus={true}
                onPress={() => setShowExitConfirm(false)}
                style={({ focused }: any) => [
                  styles.dialogBtn,
                  styles.dialogBtnSecondary,
                  focused && styles.dialogBtnFocused,
                ]}
              >
                <Text style={styles.dialogBtnText}>Continuar Assistindo</Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={handleExitAndSave}
                style={({ focused }: any) => [
                  styles.dialogBtn,
                  styles.dialogBtnPrimary,
                  focused && styles.dialogBtnFocused,
                ]}
              >
                <Text style={[styles.dialogBtnText, { color: '#070A12', fontWeight: '900' }]}>
                  Salvar e Sair
                </Text>
              </Pressable>
            </View>
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
              <Text style={styles.trackModalTitle}>Legendas Disponíveis</Text>
            </View>

            <ScrollView style={styles.trackList}>
              <Pressable
                focusable={true}
                hasTVPreferredFocus={true}
                onPress={() => {
                  try {
                    (player as any).currentSubtitleTrack = null;
                    setSelectedSubtitleId(null);
                  } catch (e) {}
                  setShowSubtitleModal(false);
                }}
                style={({ focused }: any) => [
                  styles.trackItem,
                  selectedSubtitleId === null && styles.trackItemSelected,
                  focused && styles.trackItemFocused,
                ]}
              >
                <Text style={styles.trackItemText}>Desativadas (Sem legenda)</Text>
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
    </Pressable>
  );
}

function TVControlBtn({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      focusable={true}
      onPress={onPress}
      style={({ focused }: any) => [
        styles.controlIconBtn,
        focused && styles.controlIconBtnFocused,
      ]}
    >
      <Ionicons name={icon} size={22} color="#FFFFFF" />
      <Text style={styles.controlLabel}>{label}</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 5,
  },
  bufferingText: {
    color: '#E0E6F0',
    marginTop: 14,
    fontSize: 14,
    fontWeight: '700',
  },
  seekFlashContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  seekFlashBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(7, 10, 18, 0.88)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
    elevation: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
  seekFlashText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  titleContainer: {
    flex: 1,
  },
  streamTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeText: {
    color: '#070A12',
    fontSize: 10,
    fontWeight: '900',
  },
  streamServer: {
    color: '#9AA4BC',
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingBottom: 24,
    paddingTop: 40,
    alignItems: 'center',
    zIndex: 10,
  },
  timelineWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  timelineBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  timelineBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  timeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeLabel: {
    color: '#C5C9D6',
    fontSize: 12,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    marginBottom: 12,
  },
  playPauseBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  playPauseBtnFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  controlIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 70,
  },
  controlIconBtnFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    transform: [{ scale: 1.08 }],
  },
  controlLabel: {
    color: '#A0A0A5',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  remoteHint: {
    color: '#6E7687',
    fontSize: 11,
    textAlign: 'center',
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  exitModalCard: {
    width: 440,
    backgroundColor: '#0E1322',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1B2338',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#9AA4BC',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dialogBtnPrimary: {
    backgroundColor: colors.primary,
  },
  dialogBtnSecondary: {
    backgroundColor: '#1E2845',
  },
  dialogBtnFocused: {
    borderColor: colors.focusRing,
    transform: [{ scale: 1.05 }],
  },
  dialogBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Track Selection Modals */
  trackModalCard: {
    width: 380,
    maxHeight: '80%',
    backgroundColor: '#0E1322',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1B2338',
  },
  trackModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1B2338',
    marginBottom: 10,
  },
  trackModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  trackList: {
    maxHeight: 260,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  trackItemSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  trackItemFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
  },
  trackItemText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyTrackText: {
    color: '#9AA4BC',
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 16,
    textAlign: 'center',
  },
  closeTrackBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#1E2845',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  closeTrackBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
