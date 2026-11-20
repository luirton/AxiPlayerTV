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
import { storage, WatchProgressItem } from '../../src/services/storage';
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
    streamUrl: initialStreamUrl,
    startPosition,
    seriesId,
    seriesTitle,
    seasonNum,
    episodeNum,
  } = useLocalSearchParams<{
    id: string;
    type?: 'live' | 'movie' | 'series';
    name?: string;
    container?: string;
    icon?: string;
    streamUrl?: string;
    startPosition?: string;
    seriesId?: string;
    seriesTitle?: string;
    seasonNum?: string;
    episodeNum?: string;
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
  const streamUrlRef = useRef<string | null>(null);
  const currentContainerRef = useRef<string>(container || 'mp4');
  const triedIdsRef = useRef<Set<string>>(new Set([String(id)]));
  const targetPositionRef = useRef<number>(0);
  const initialSeekDoneRef = useRef<boolean>(false);

  // Refs e Lógica para Avanço / Retrocesso Contínuo e Acelerado (Controle Remoto TV e Touch)
  const continuousSeekTimerRef = useRef<any>(null);
  const continuousSeekIntervalRef = useRef<any>(null);
  const isContinuousSeekingRef = useRef<boolean>(false);
  const continuousTargetRef = useRef<number>(0);
  const continuousStartPosRef = useRef<number>(0);
  const continuousTicksRef = useRef<number>(0);
  const lastPressTimeRef = useRef<number>(0);
  const pressStreakRef = useRef<number>(0);
  const accumulatedSeekSecRef = useRef<number>(0);
  const seekCommitDebounceRef = useRef<any>(null);

  currentTimeRef.current = currentTime;
  durationRef.current = duration;
  streamUrlRef.current = streamUrl;

  // Inicia ou reinicia o temporizador de segurança (mínimo de 10 segundos conforme solicitado)
  const startLoadingWatchdog = useCallback(() => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      if (currentTimeRef.current <= 0) {
        handlePlaybackFailure();
      }
    }, 10000);
  }, []);

  // 1. Resolve Stream URL and Restore Last Saved Progress
  useEffect(() => {
    let isMounted = true;
    const resolveUrl = async () => {
      try {
        const profile = await storage.getActiveProfile();
        if (!profile) return;
        xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

        let url: string | null = null;
        let savedProgress: WatchProgressItem | null = null;

        // Se for VOD, busca progresso salvo previamente pelo ID ou pelo título
        if (isVod) {
          savedProgress = await storage.getWatchProgress(currentPlayingId, name);
          if (!savedProgress && seriesId) {
            savedProgress = await storage.getWatchProgress(seriesId, seriesTitle || name);
          }
          // Prioriza SEMPRE o link/versão que já deu certo no histórico salvo!
          if (savedProgress?.streamUrl) {
            url = savedProgress.streamUrl;
            if (savedProgress.extension) {
              currentContainerRef.current = savedProgress.extension;
            }
            if (savedProgress.id && String(savedProgress.id) !== currentPlayingId) {
              const workingId = String(savedProgress.id);
              triedIdsRef.current.add(workingId);
              setCurrentPlayingId(workingId);
            }
          }
        }

        // Se não tinha no histórico com streamUrl confirmada, usa initialStreamUrl se foi passado
        if (!url && initialStreamUrl) {
          url = initialStreamUrl;
        }

        // Se ainda não tiver url, gera do client
        if (!url) {
          url = xtreamClient.getStreamUrl(
            currentPlayingId,
            type as 'live' | 'movie' | 'series',
            currentContainerRef.current || container || 'mp4'
          );
        }

        if (isMounted && url) {
          setStreamUrl(url);
          streamUrlRef.current = url;
          setIsBuffering(true);
          // Inicia a contagem de 10s a partir do momento em que a URL é definida
          startLoadingWatchdog();
        }

        // Check if favorite
        if (type === 'movie') {
          const favs = await storage.getMovieFavorites();
          if (isMounted) setIsFavorite(favs.includes(Number(currentPlayingId)));
        } else if (type === 'series') {
          const favs = await storage.getSeriesFavorites();
          if (isMounted) setIsFavorite(favs.includes(Number(currentPlayingId)));
        }

        // Restore saved progress for VOD (usando startPosition se fornecido ou do progresso salvo)
        if (isVod) {
          const targetPos = startPosition ? Number(startPosition) : (savedProgress?.positionSec || 0);
          const targetDur = savedProgress?.durationSec || 0;
          if (targetPos > 2) {
            targetPositionRef.current = targetPos;
            initialSeekDoneRef.current = false;
            setCurrentTime(targetPos);
            currentTimeRef.current = targetPos;
          }
          if (targetDur > 0) {
            setDuration(targetDur);
            durationRef.current = targetDur;
          }
        }
      } catch (e) {
        console.warn('Erro ao resolver URL do player TV:', e);
      }
    };

    resolveUrl();
    return () => {
      isMounted = false;
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [currentPlayingId, type, container, isVod, initialStreamUrl, startPosition, seriesId]);

  // 2. Video Player Instance from expo-video (sem p.play() no mount com source null)
  const player = useVideoPlayer(streamUrl || null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
  });

  // Atualiza reprodução quando streamUrl estiver definido
  useEffect(() => {
    if (player && streamUrl) {
      try {
        player.play();
      } catch (e) {
        console.warn('Erro ao iniciar streamUrl no player:', e);
      }
    }
  }, [player, streamUrl]);

  // Aplica o seek inicial de onde o usuário parou
  const applyInitialSeekIfNeeded = useCallback((p: any) => {
    if (!initialSeekDoneRef.current && targetPositionRef.current > 2) {
      initialSeekDoneRef.current = true;
      const targetSec = targetPositionRef.current;
      try {
        p.currentTime = targetSec;
        setCurrentTime(targetSec);
        currentTimeRef.current = targetSec;
      } catch (e) {
        // Falha silenciosa de seek
      }
    }
  }, []);

  // Handler de Falha de Reprodução e Busca de Próxima Versão com AUTO-FALLBACK
  const handlePlaybackFailure = useCallback(async () => {
    if (playbackFailureTriggeredRef.current) return;
    playbackFailureTriggeredRef.current = true;
    setIsBuffering(true);

    try {
      if (type === 'movie') {
        triedIdsRef.current.add(String(currentPlayingId || id));
        const alts = await findAlternativeMovieVersions(name, Number(currentPlayingId || id));
        // Encontra uma versão que ainda não foi tentada
        const nextVer = alts.find((a) => !triedIdsRef.current.has(String(a.stream_id)));
        if (nextVer) {
          const nextId = String(nextVer.stream_id);
          const nextExt = nextVer.container_extension || 'mp4';
          triedIdsRef.current.add(nextId);
          currentContainerRef.current = nextExt;
          setCurrentPlayingId(nextId);
          const newUrl = xtreamClient.getStreamUrl(nextId, 'movie', nextExt);
          setStreamUrl(newUrl);
          streamUrlRef.current = newUrl;
          playbackFailureTriggeredRef.current = false;
          setShowErrorModal(false);
          setIsBuffering(true);

          if (player) {
            try {
              player.play();
            } catch (e) {}
          }
          // Dá mais 10 segundos para a versão alternativa responder
          startLoadingWatchdog();
          return;
        }
      }
    } catch (e) {
      console.warn('Erro no auto-fallback:', e);
    }

    // Se nenhuma versão alternativa foi encontrada ou todas falharam:
    setIsBuffering(false);
    setShowErrorModal(true);
  }, [name, currentPlayingId, id, type, player, startLoadingWatchdog]);

  // Tentar Próxima Versão manual (se acionado pelo modal)
  const handleTryNextVersion = () => {
    if (!suggestedNextVersion || !player) return;
    setShowErrorModal(false);
    setIsBuffering(true);
    playbackFailureTriggeredRef.current = false;
    const nextId = String(suggestedNextVersion.stream_id);
    const nextExt = suggestedNextVersion.container_extension || 'mp4';
    triedIdsRef.current.add(nextId);
    currentContainerRef.current = nextExt;
    setCurrentPlayingId(nextId);
    const newUrl = xtreamClient.getStreamUrl(
      nextId,
      'movie',
      nextExt
    );
    setStreamUrl(newUrl);
    streamUrlRef.current = newUrl;
    try {
      player.play();
    } catch (e) {
      console.warn('Erro ao trocar stream:', e);
    }
    startLoadingWatchdog();
  };

  // 3. Player Event Listeners
  useEffect(() => {
    if (!player) return;

    const subPlayingChange = player.addListener('playingChange', (payload) => {
      setIsPlaying(payload.isPlaying);
      if (payload.isPlaying) {
        setIsBuffering(false);
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        applyInitialSeekIfNeeded(player);
      }
    });

    const subStatusChange = player.addListener('statusChange', (payload) => {
      if (payload.status === 'readyToPlay') {
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        playbackFailureTriggeredRef.current = false;
        setShowErrorModal(false);
        setIsBuffering(false);
        const dur = player.duration || 0;
        if (dur > 0) {
          setDuration(dur);
          durationRef.current = dur;
        }

        // Aplica o seek da posição salva de onde parou
        applyInitialSeekIfNeeded(player);
      } else if (payload.status === 'loading') {
        setIsBuffering(true);
      } else if (payload.status === 'error') {
        // Ignora status error se ainda não há URL ou nos primeiros instantes
        if (!streamUrlRef.current) return;
      }
    });

    const subTimeUpdate = player.addListener('timeUpdate', (payload) => {
      if (payload.currentTime > 0) {
        setIsBuffering(false);
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      }

      // Se ainda não aplicou o seek inicial para a posição salva:
      if (!initialSeekDoneRef.current && targetPositionRef.current > 2) {
        applyInitialSeekIfNeeded(player);
        return;
      }

      currentTimeRef.current = payload.currentTime;
      setCurrentTime(payload.currentTime);
      if (player.duration && player.duration > 0) {
        durationRef.current = player.duration;
        setDuration(player.duration);
      }
    });

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      subPlayingChange.remove();
      subStatusChange.remove();
      subTimeUpdate.remove();
    };
  }, [player, applyInitialSeekIfNeeded]);

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

  // 4. Salva Progresso Periodicamente (a cada 5 segundos para VOD) guardando o link que deu certo
  const saveCurrentProgress = useCallback(async () => {
    const pos = Math.floor(currentTimeRef.current);
    if (!isVod || pos <= 5) return;
    const finalStreamUrl = streamUrlRef.current || streamUrl;
    if (!finalStreamUrl) return;
    try {
      await storage.saveWatchProgress({
        id: String(currentPlayingId || id),
        title: name || 'Título',
        poster: icon || undefined,
        type: type as 'movie' | 'series',
        positionSec: pos,
        durationSec: Math.floor(durationRef.current),
        extension: currentContainerRef.current || container || 'mp4',
        streamUrl: finalStreamUrl,
        seriesId: seriesId ? String(seriesId) : undefined,
        seriesTitle: seriesTitle || undefined,
        seasonNum: seasonNum ? Number(seasonNum) : undefined,
        episodeNum: episodeNum ? Number(episodeNum) : undefined,
        timestamp: Date.now(),
      });
    } catch (e) {}
  }, [currentPlayingId, id, name, icon, type, container, streamUrl, seriesId, seriesTitle, seasonNum, episodeNum, isVod]);

  useEffect(() => {
    if (!isVod) return;
    progressSaveTimerRef.current = setInterval(() => {
      saveCurrentProgress();
    }, 5000);

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

  const formatOffsetLabel = (sec: number) => {
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    if (m > 0) {
      return `${sec >= 0 ? '+' : '-'}${m}m ${s > 0 ? `${s}s` : ''}`.trim();
    }
    return `${sec >= 0 ? '+' : ''}${sec}s`;
  };

  // Comita o avanço acumulado para o player de vídeo (após soltar a tecla no controle ou tela)
  const commitAccumulatedSeek = useCallback(() => {
    if (seekCommitDebounceRef.current) {
      clearTimeout(seekCommitDebounceRef.current);
      seekCommitDebounceRef.current = null;
    }
    const finalTarget = accumulatedSeekSecRef.current;
    if (player && durationRef.current > 0 && finalTarget >= 0) {
      player.currentTime = finalTarget;
      setCurrentTime(finalTarget);
      currentTimeRef.current = finalTarget;
      saveCurrentProgress();
    }

    setSeekFlash({
      visible: true,
      type: 'fwd',
      label: `▶ ${formatTime(finalTarget)}`,
    });

    if (seekFlashTimerRef.current) clearTimeout(seekFlashTimerRef.current);
    seekFlashTimerRef.current = setTimeout(() => {
      setSeekFlash((prev) => ({ ...prev, visible: false }));
    }, 1200);

    setTimeout(() => {
      isContinuousSeekingRef.current = false;
      pressStreakRef.current = 0;
    }, 200);
  }, [player, saveCurrentProgress]);

  // Avanço e Retrocesso Contínuos e Acelerados ao Segurar os Botões no Controle Remoto da TV ou Touch
  const startContinuousSeek = (direction: 'fwd' | 'rwd') => {
    if (durationRef.current <= 0) return;
    if (continuousSeekTimerRef.current) clearTimeout(continuousSeekTimerRef.current);
    if (continuousSeekIntervalRef.current) clearInterval(continuousSeekIntervalRef.current);

    isContinuousSeekingRef.current = true;
    continuousTicksRef.current = 0;
    continuousStartPosRef.current = currentTimeRef.current;
    accumulatedSeekSecRef.current = currentTimeRef.current;
    resetHideTimer();

    // Loop rápido a cada 90ms com avanço progressivo acelerado
    continuousSeekIntervalRef.current = setInterval(() => {
      continuousTicksRef.current += 1;
      const ticks = continuousTicksRef.current;

      // Aceleração progressiva veloz:
      // Ticks 1..4 (~0.4s): 15s por tick
      // Ticks 5..12 (~1.1s): 35s por tick
      // Ticks 13..24 (~2.2s): 75s por tick
      // Ticks > 24: 150s por tick (~1600s/s)
      let step = 15;
      if (ticks > 24) step = 150;
      else if (ticks > 12) step = 75;
      else if (ticks > 4) step = 35;

      const delta = direction === 'fwd' ? step : -step;
      const newTarget = Math.max(0, Math.min(durationRef.current, accumulatedSeekSecRef.current + delta));
      accumulatedSeekSecRef.current = newTarget;
      continuousTargetRef.current = newTarget;

      setCurrentTime(newTarget);
      currentTimeRef.current = newTarget;

      const totalDiff = Math.round(newTarget - continuousStartPosRef.current);
      setSeekFlash({
        visible: true,
        type: direction,
        label: `${direction === 'fwd' ? '⏩' : '⏪'} ${formatOffsetLabel(totalDiff)} (${formatTime(newTarget)})`,
      });

      resetHideTimer();
    }, 90);
  };

  const handleSeekPressIn = (direction: 'fwd' | 'rwd') => {
    if (durationRef.current <= 0) return;
    if (continuousSeekTimerRef.current) clearTimeout(continuousSeekTimerRef.current);
    if (continuousSeekIntervalRef.current) clearInterval(continuousSeekIntervalRef.current);

    // Se segurado por mais de 180ms, engata avanço contínuo rápido
    continuousSeekTimerRef.current = setTimeout(() => {
      startContinuousSeek(direction);
    }, 180);
  };

  const handleSeekLongPress = (direction: 'fwd' | 'rwd') => {
    // Disparo de clique longo no controle remoto ou tela
    if (!isContinuousSeekingRef.current) {
      startContinuousSeek(direction);
    }
  };

  const handleSeekPressOut = (direction: 'fwd' | 'rwd') => {
    if (continuousSeekTimerRef.current) {
      clearTimeout(continuousSeekTimerRef.current);
      continuousSeekTimerRef.current = null;
    }
    if (continuousSeekIntervalRef.current) {
      clearInterval(continuousSeekIntervalRef.current);
      continuousSeekIntervalRef.current = null;
    }

    if (isContinuousSeekingRef.current) {
      commitAccumulatedSeek();
    }
  };

  // Disparo do clique no controle remoto da TV: detecta key-repeat e acelera progressivamente
  const handleCircularBtnPress = (offsetSec: number) => {
    if (durationRef.current <= 0) return;
    const now = Date.now();
    const timeDiff = now - lastPressTimeRef.current;
    lastPressTimeRef.current = now;
    const isFwd = offsetSec > 0;

    // Se o usuário estiver segurando a tecla no controle remoto da TV,
    // o Android emite eventos de repetição com intervalo entre 70ms e 400ms:
    if (timeDiff < 450 && pressStreakRef.current > 0) {
      pressStreakRef.current += 1;
    } else {
      pressStreakRef.current = 1;
      accumulatedSeekSecRef.current = currentTimeRef.current;
      continuousStartPosRef.current = currentTimeRef.current;
    }

    const streak = pressStreakRef.current;

    // Aceleração progressiva dinâmica no controle remoto da TV:
    let step = 10;
    if (streak > 24) {
      step = 150; // Acima de ~2.5s segurando tecla: pula 2.5 minutos por pulso
    } else if (streak > 14) {
      step = 80;  // Acima de ~1.5s: pula 1m 20s por pulso
    } else if (streak > 7) {
      step = 40;  // Acima de ~0.8s: pula 40s por pulso
    } else if (streak > 2) {
      step = 20;  // Segundo e terceiro pulsos rápidos: 20s
    } else {
      step = 10;  // Clique inicial isolado: 10s padrão
    }

    const delta = isFwd ? step : -step;
    const newTarget = Math.max(0, Math.min(durationRef.current, accumulatedSeekSecRef.current + delta));
    accumulatedSeekSecRef.current = newTarget;
    continuousTargetRef.current = newTarget;
    isContinuousSeekingRef.current = true;

    // Atualização visual instantânea em tempo real (sem engasgar decoder de vídeo)
    setCurrentTime(newTarget);
    currentTimeRef.current = newTarget;

    const totalDiff = Math.round(newTarget - continuousStartPosRef.current);
    setSeekFlash({
      visible: true,
      type: isFwd ? 'fwd' : 'rwd',
      label: `${isFwd ? '⏩' : '⏪'} ${formatOffsetLabel(totalDiff)} (${formatTime(newTarget)})`,
    });

    resetHideTimer();

    // Debounce do commit ao player: aplica ao soltar o botão do controle remoto
    if (seekCommitDebounceRef.current) clearTimeout(seekCommitDebounceRef.current);
    seekCommitDebounceRef.current = setTimeout(() => {
      commitAccumulatedSeek();
    }, 320);
  };

  // Limpeza de timers ao desmontar o componente
  useEffect(() => {
    return () => {
      if (continuousSeekTimerRef.current) clearTimeout(continuousSeekTimerRef.current);
      if (continuousSeekIntervalRef.current) clearInterval(continuousSeekIntervalRef.current);
      if (seekCommitDebounceRef.current) clearTimeout(seekCommitDebounceRef.current);
      if (seekFlashTimerRef.current) clearTimeout(seekFlashTimerRef.current);
    };
  }, []);

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

          {/* Controles Centrais (Imagem 9): -10s, Play/Pause Central Gigante, +10s */}
          <View style={styles.centerControlsContainer} pointerEvents="box-none">
            {isVod && (
              <TVPlayerCircularBtn
                icon="refresh"
                badgeText="10"
                isCounterClockwise={true}
                onPress={() => handleCircularBtnPress(-10)}
                onPressIn={() => handleSeekPressIn('rwd')}
                onPressOut={() => handleSeekPressOut('rwd')}
                onLongPress={() => handleSeekLongPress('rwd')}
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
                onPress={() => handleCircularBtnPress(10)}
                onPressIn={() => handleSeekPressIn('fwd')}
                onPressOut={() => handleSeekPressOut('fwd')}
                onLongPress={() => handleSeekLongPress('fwd')}
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
              Ajuste de Tela: {contentFit.toUpperCase()}
            </Text>

            <FocusableDialogButton
              label="Fechar"
              variant="secondary"
              hasTVPreferredFocus={true}
              onPress={() => setShowInfoModal(false)}
              style={{ width: '100%', marginTop: 8 }}
            />
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
              <FocusableDialogButton
                label="Continuar Assistindo"
                variant="continue"
                hasTVPreferredFocus={true}
                onPress={() => setShowExitConfirm(false)}
              />

              {/* Salvar e Sair */}
              <FocusableDialogButton
                label="Salvar e Sair"
                variant="secondary"
                onPress={handleExitAndSave}
              />
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
                  <FocusableDialogButton
                    label="Tentar Próxima Versão"
                    variant="continue"
                    icon="play"
                    hasTVPreferredFocus={true}
                    onPress={handleTryNextVersion}
                  />

                  <FocusableDialogButton
                    label="Voltar ao Catálogo"
                    variant="secondary"
                    onPress={() => router.back()}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.errorModalSubtitle}>
                  Não foi possível reproduzir este filme e nenhuma versão alternativa foi encontrada na sua lista IPTV no momento. Tente novamente mais tarde.
                </Text>

                <View style={[styles.modalActionsRow, { justifyContent: 'center' }]}>
                  <FocusableDialogButton
                    label="Voltar ao Catálogo"
                    variant="continue"
                    hasTVPreferredFocus={true}
                    onPress={() => router.back()}
                    style={{ maxWidth: 220 }}
                  />
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

            <FocusableDialogButton
              label="Fechar"
              variant="secondary"
              hasTVPreferredFocus={true}
              onPress={() => setShowAudioModal(false)}
              style={{ width: '100%', marginTop: 12 }}
            />
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

            <FocusableDialogButton
              label="Fechar"
              variant="secondary"
              hasTVPreferredFocus={true}
              onPress={() => setShowSubtitleModal(false)}
              style={{ width: '100%', marginTop: 12 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Botão Focável de Alto Contraste para Modais e Diálogos da TV (Continuar Assistindo, Salvar e Sair, etc.)
function FocusableDialogButton({
  label,
  icon,
  iconColor,
  onPress,
  hasTVPreferredFocus = false,
  variant = 'secondary',
  style,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  variant?: 'continue' | 'secondary' | 'primary';
  style?: any;
}) {
  const [isFocused, setIsFocused] = useState(false);

  let bg = '#1E2845';
  let border = '#2A365B';
  let textColor = '#FFFFFF';

  if (variant === 'continue') {
    // Continuar Assistindo: Branco sólido com anel de foco Cyan e glow
    bg = '#FFFFFF';
    border = isFocused ? colors.primary : '#FFFFFF';
    textColor = '#000000';
  } else if (variant === 'primary') {
    bg = isFocused ? '#FFFFFF' : colors.primary;
    border = isFocused ? colors.primary : 'transparent';
    textColor = isFocused ? '#000000' : '#070A12';
  } else {
    // secondary: Salvar e Sair / Voltar / Fechar
    bg = isFocused ? colors.primary : '#1E2845';
    border = isFocused ? '#FFFFFF' : '#2A365B';
    textColor = isFocused ? '#070A12' : '#FFFFFF';
  }

  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.dialogBtn,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: isFocused ? 2.5 : 1.5,
        },
        isFocused && styles.dialogBtnAnyFocused,
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={16}
          color={iconColor || textColor}
          style={{ marginRight: 6 }}
        />
      )}
      <Text
        style={[
          styles.dialogBtnTextBase,
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
  onPressIn,
  onPressOut,
  onLongPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  badgeText: string;
  isCounterClockwise: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onLongPress?: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      delayLongPress={200}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        onPressOut?.();
      }}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onLongPress}
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
    flexDirection: 'row',
  },
  dialogBtnAnyFocused: {
    transform: [{ scale: 1.08 }],
    elevation: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  dialogBtnTextBase: {
    fontSize: 14,
    letterSpacing: 0.3,
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
