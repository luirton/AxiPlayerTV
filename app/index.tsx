import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Easing, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { storage } from '../src/services/storage';
import { colors } from '../src/theme/colors';

export default function TVSplashScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [statusText, setStatusText] = useState('Iniciando...');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // 1. Entrance animation (Emblem fade & scale)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Ambient neon pulse glow behind emblem
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.85,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    let isMounted = true;

    async function initTVApp() {
      try {
        if (isMounted) setStatusText('Verificando perfil salvo...');
        await new Promise((r) => setTimeout(r, 450));

        const active = await storage.getActiveProfile();

        if (isMounted) setStatusText(active ? 'Carregando lista IPTV...' : 'Preparando tela de conexão...');
        await new Promise((r) => setTimeout(r, 550));

        if (isMounted) setStatusText('Pronto!');

        setTimeout(() => {
          if (!isMounted) return;
          if (active) {
            router.replace('/(tv)/home');
          } else {
            router.replace('/login');
          }
        }, 400);
      } catch (err) {
        console.warn('Erro na inicialização da TV:', err);
        if (isMounted) router.replace('/login');
      }
    }

    initTVApp();

    return () => {
      isMounted = false;
      pulseLoop.stop();
    };
  }, [router]);

  const emblemSize = Math.min(height * 0.32, 130);

  return (
    <View style={styles.container}>
      {/* Landscape Background with top lighting rays / soft cyan & purple bloom */}
      <LinearGradient
        colors={['rgba(0, 229, 255, 0.12)', 'rgba(168, 85, 247, 0.08)', '#070A12', '#05070D']}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.contentBox,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Glow halo behind emblem */}
        <Animated.View
          style={[
            styles.glowHalo,
            {
              width: emblemSize * 1.8,
              height: emblemSize * 1.8,
              borderRadius: (emblemSize * 1.8) / 2,
              opacity: glowAnim,
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(0, 229, 255, 0.45)', 'rgba(168, 85, 247, 0.25)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* 3D Cyan & Magenta 'A' Play Emblem */}
        <Image
          source={require('../assets/emblem_transparent.png')}
          style={[styles.emblem, { width: emblemSize, height: emblemSize }]}
          contentFit="contain"
          transition={300}
        />

        {/* Typography: AxiPlayer TV */}
        <View style={styles.brandingBox}>
          <Text style={styles.brandTitle}>
            AxiPlayer<Text style={styles.brandTv}>TV</Text>
          </Text>
          <Text style={styles.brandSubtitle}>Android TV & Google TV Edition</Text>
        </View>

        {/* Circular Neon Loading Spinner */}
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </Animated.View>

      {/* Footer attribution */}
      <View style={styles.footerBox}>
        <Text style={styles.footerText}>Axi Player TV • Created by Luirton Gurgel</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
  },
  emblem: {
    marginBottom: 16,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  brandingBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandTv: {
    color: colors.primaryAmber,
    fontWeight: '900',
  },
  brandSubtitle: {
    color: '#9AA4BC',
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.8,
  },
  loaderContainer: {
    alignItems: 'center',
    marginTop: 8,
    minHeight: 64,
  },
  statusText: {
    marginTop: 14,
    color: '#8A92A6',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  footerBox: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#3A4256',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
  },
});
