import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Easing, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { storage } from '../src/services/storage';
import { colors } from '../src/theme/colors';

// Prevent native splash screen from hiding prematurely before React Native mounts
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function TVSplashScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [statusText, setStatusText] = useState('Iniciando...');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // Hide native splash screen smoothly so JS splash continues with animation
    SplashScreen.hideAsync().catch(() => {});

    // 1. Entrance animation (Emblem fade & scale)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    let isMounted = true;

    async function initTVApp() {
      try {
        if (isMounted) setStatusText('Verificando perfil...');
        const active = await storage.getActiveProfile();

        if (isMounted) setStatusText(active ? 'Carregando lista IPTV...' : 'Iniciando...');

        setTimeout(() => {
          if (!isMounted) return;
          if (active) {
            router.replace('/(tv)/home');
          } else {
            router.replace('/login');
          }
        }, 300);
      } catch (err) {
        console.warn('Erro na inicialização da TV:', err);
        if (isMounted) router.replace('/login');
      }
    }

    initTVApp();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const emblemSize = Math.min(height * 0.30, 120);

  return (
    <View style={styles.container}>
      {/* Background limpo OLED dark */}
      <LinearGradient
        colors={['#0C0E16', '#070A12', '#05070D']}
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
        {/* 3D Cyan & Magenta 'A' Play Emblem */}
        <Image
          source={require('../assets/emblem_transparent.png')}
          style={[styles.emblem, { width: emblemSize, height: emblemSize }]}
          contentFit="contain"
          transition={200}
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
