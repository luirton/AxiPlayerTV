import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { storage } from '../src/services/storage';
import { colors } from '../src/theme/colors';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const activeProfile = await storage.getActiveProfile();
        if (activeProfile) {
          router.replace('/(tv)/home');
        } else {
          router.replace('/login');
        }
      } catch (err) {
        console.error('Error verifying auth profile:', err);
        router.replace('/login');
      }
    };

    const timer = setTimeout(checkAuth, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoBadge}>
        <Text style={styles.logoLetter}>A</Text>
      </View>
      <Text style={styles.brandTitle}>AXI PLAYER TV</Text>
      <Text style={styles.brandSubtitle}>Google TV & Android TV</Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
  },
  logoLetter: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 1,
  },
  spinner: {
    marginTop: 32,
  },
});
