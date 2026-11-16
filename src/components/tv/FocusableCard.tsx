import React, { useState } from 'react';
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

interface FocusableCardProps {
  title: string;
  imageUrl?: string;
  subtitle?: string;
  badge?: string;
  rating?: number | string;
  onPress: () => void;
  onFocus?: () => void;
  aspectRatio?: number; // default 2/3 for posters, 16/9 for banners
  width?: number;
  style?: StyleProp<ViewStyle>;
  hasTVPreferredFocus?: boolean;
}

export const FocusableCard: React.FC<FocusableCardProps> = ({
  title,
  imageUrl,
  subtitle,
  badge,
  rating,
  onPress,
  onFocus,
  aspectRatio = 2 / 3,
  width = 160,
  style,
  hasTVPreferredFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const height = width / aspectRatio;

  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={onPress}
      style={[
        styles.cardContainer,
        { width, height },
        isFocused && styles.focused,
        style,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Text style={styles.placeholderText} numberOfLines={2}>
            {title}
          </Text>
        </View>
      )}

      {/* Dark gradient at bottom for legible titles */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.gradient}
      />

      {/* Badges on Top */}
      <View style={styles.topRow}>
        {badge ? (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {rating ? (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {rating}</Text>
          </View>
        ) : null}
      </View>

      {/* Content Info at Bottom */}
      <View style={styles.infoContainer}>
        <Text style={[styles.title, isFocused && styles.titleFocused]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 14,
  },
  focused: {
    borderColor: colors.focusRing,
    transform: [{ scale: Platform.isTV ? 1.06 : 1.04 }],
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    zIndex: 10,
  },
  placeholder: {
    backgroundColor: '#262629',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  placeholderText: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  topRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeContainer: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  ratingBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoContainer: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  titleFocused: {
    color: colors.focusRing,
  },
  subtitle: {
    color: '#A0A0A5',
    fontSize: 11,
    marginTop: 2,
  },
});
