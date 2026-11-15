import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  BackHandler,
  Platform,
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
  const { id, type = 'live', name = 'Transmissão', container = 'mp4' } = useLocalSearchParams<{
    id: string;
    type: 'live' | 'movie' | 'series';
    name: string;
    container?: string;
  }>();

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize stream URL
  useEffect(() => {
    const resolveUrl = async () => {
      const profile = await storage.getActiveProfile();
      if (!profile) return;
      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

      const url = xtreamClient.getStreamUrl(
        id,
        type as 'live' | 'movie' | 'series',
        container
      );
      setStreamUrl(url);
    };

    resolveUrl();
  }, [id, type, container]);

  // Video player hook from expo-video
  const player = useVideoPlayer(streamUrl || '', (p) => {
    p.loop = type !== 'live';
    p.play();
  });

  // Handle Remote Control Back Button
  useEffect(() => {
    const onBackPress = () => {
      if (showControls) {
        setShowControls(false);
        return true; // consumes back button, keeping video playing
      }
      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [showControls]);

  // Auto-hide controls timer
  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4500);
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const togglePlayPause = () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
    resetHideTimer();
  };

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
          style={StyleSheet.absoluteFillObject}
          contentFit="contain"
          nativeControls={false}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Conectando ao fluxo de vídeo...</Text>
        </View>
      )}

      {/* On-Screen Display (OSD) Overlay */}
      {showControls && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          {/* Top Bar OSD */}
          <LinearGradient
            colors={['rgba(0,0,0,0.85)', 'transparent']}
            style={styles.topBar}
          >
            <Pressable
              focusable={true}
              onPress={() => router.back()}
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
                <Text style={styles.streamServer}>ExoPlayer HW</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Bottom Controls OSD */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.92)']}
            style={styles.bottomBar}
          >
            <View style={styles.controlsRow}>
              <Pressable
                focusable={true}
                onPress={() => router.back()}
                style={styles.controlIconBtn}
              >
                <Ionicons name="list" size={24} color="#FFFFFF" />
                <Text style={styles.controlLabel}>Guia</Text>
              </Pressable>

              <Pressable
                focusable={true}
                hasTVPreferredFocus={true}
                onPress={togglePlayPause}
                style={[styles.playPauseBtn]}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={32}
                  color="#FFFFFF"
                />
              </Pressable>

              <Pressable
                focusable={true}
                onPress={() => setShowControls(false)}
                style={styles.controlIconBtn}
              >
                <Ionicons name="expand" size={24} color="#FFFFFF" />
                <Text style={styles.controlLabel}>Ocultar</Text>
              </Pressable>
            </View>

            <Text style={styles.remoteHint}>
              💡 D-Pad Cima/Baixo: Zapping • OK: Menu • Voltar: Fechar painel
            </Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 14,
    fontSize: 14,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  streamServer: {
    color: '#8E8E93',
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 32,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  controlIconBtn: {
    alignItems: 'center',
    padding: 8,
  },
  controlLabel: {
    color: '#A0A0A5',
    fontSize: 11,
    marginTop: 4,
  },
  remoteHint: {
    color: '#66666E',
    fontSize: 11,
    textAlign: 'center',
  },
});
