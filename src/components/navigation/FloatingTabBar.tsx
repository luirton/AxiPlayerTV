import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { uiState } from '../../services/uiState';

export const FloatingTabBar = (props: any) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = props?.state;
  const [isFullscreen, setIsFullscreen] = useState(uiState.getFullscreen());

  useEffect(() => {
    return uiState.subscribe((val) => {
      setIsFullscreen(val);
    });
  }, []);

  if (isFullscreen || !state || !state.routes) {
    return null;
  }

  // Eleva o menu flutuante para garantir que não colida com os botões ou barra de gestos do Android
  const bottomOffset = Math.max(insets.bottom + 16, 42);

  return (
    <View style={[styles.wrapper, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.pillContainer}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;

          const onPress = () => {
            if (isFocused) return;
            const targetPath = route.name === 'index' ? '/(tabs)' : `/(tabs)/${route.name}`;
            router.push(targetPath as any);
          };

          let iconName: any = 'home';
          let label = 'Início';

          if (route.name === 'index') {
            iconName = 'home';
            label = 'Início';
          } else if (route.name === 'live') {
            iconName = 'radio';
            label = 'TV ao vivo';
          } else if (route.name === 'movies') {
            iconName = 'film';
            label = 'Filmes';
          } else if (route.name === 'series') {
            iconName = 'albums';
            label = 'Séries';
          } else if (route.name === 'settings') {
            iconName = 'menu';
            label = 'Menu';
          }

          if (isFocused) {
            return (
              <Pressable key={route.key} onPress={onPress} style={styles.activeTabWrapper}>
                <LinearGradient
                  colors={['#FF6A00', '#FFA000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activePill}
                >
                  <Ionicons name={iconName} size={18} color="#000" />
                  <Text style={styles.activeLabel}>{label}</Text>
                </LinearGradient>
              </Pressable>
            );
          }

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.inactiveTab}>
              <Ionicons name={`${iconName}-outline` as any} size={22} color="#8E8E93" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: 36,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#2A2A2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
    gap: 6,
  },
  activeTabWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 28,
    gap: 6,
  },
  activeLabel: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
  inactiveTab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
