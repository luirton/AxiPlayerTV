import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, StyleProp, ViewStyle } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getEnrichedPoster } from '../../services/metadataEnricher';
import { colors } from '../../theme/colors';

interface EnrichedPosterImageProps {
  sourceUri?: string | null;
  title: string;
  type?: 'movie' | 'series';
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  contentFit?: 'cover' | 'contain' | 'fill';
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  isFocused?: boolean;
}

export const EnrichedPosterImage: React.FC<EnrichedPosterImageProps> = ({
  sourceUri,
  title,
  type = 'movie',
  style,
  containerStyle,
  contentFit = 'cover',
  fallbackIcon = 'film-outline',
  isFocused = false,
}) => {
  const [currentUri, setCurrentUri] = useState<string | null>(sourceUri || null);
  const [hasTriedEnrich, setHasTriedEnrich] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setCurrentUri(sourceUri || null);
    setHasTriedEnrich(false);

    // Se não veio imagem da lista IPTV, busca imediatamente na internet (IMDb / iTunes)
    if (!sourceUri || sourceUri.trim() === '') {
      lookupPoster();
    }
  }, [sourceUri, title, type]);

  const lookupPoster = async () => {
    if (hasTriedEnrich || !title) return;
    setHasTriedEnrich(true);
    setIsLoading(true);
    try {
      const enrichedUrl = await getEnrichedPoster(title, type);
      if (enrichedUrl) {
        setCurrentUri(enrichedUrl);
      }
    } catch (e) {
      // Falha silenciosa
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageError = () => {
    if (!hasTriedEnrich) {
      lookupPoster();
    }
  };

  const focusStyle = isFocused
    ? {
        borderWidth: 2.5,
        borderColor: colors.neonCyan,
        shadowColor: colors.neonCyan,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.9,
        shadowRadius: 10,
        elevation: 10,
        transform: [{ scale: 1.05 }],
      }
    : null;

  if (currentUri && currentUri.trim() !== '') {
    return (
      <View style={[styles.wrapper, containerStyle, focusStyle]}>
        <Image
          source={{ uri: currentUri }}
          style={[styles.imageDefault, style]}
          contentFit={contentFit}
          onError={handleImageError}
          transition={200}
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, styles.fallbackContainer, containerStyle, style as any, focusStyle]}>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name={fallbackIcon} size={32} color={colors.textMuted} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  imageDefault: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    backgroundColor: '#121624',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
