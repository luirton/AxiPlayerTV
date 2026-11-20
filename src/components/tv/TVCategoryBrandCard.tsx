import React, { useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

interface TVCategoryBrandCardProps {
  label: string;
  accentColor: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}

// Determina se a cor de fundo requer texto escuro ou claro para máximo contraste
function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  const c = hex.substring(1);
  const rgb = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 155;
}

export const TVCategoryBrandCard: React.FC<TVCategoryBrandCardProps> = ({
  label,
  accentColor,
  onPress,
  hasTVPreferredFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const isLight = isLightColor(accentColor);
  const focusedTextColor = isLight ? '#070A12' : '#FFFFFF';

  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: isFocused ? '#FFFFFF' : accentColor,
          backgroundColor: isFocused ? accentColor : '#0E1322',
          shadowColor: accentColor,
        },
        isFocused && styles.cardFocused,
      ]}
    >
      <Text
        style={[
          styles.labelText,
          {
            color: isFocused ? focusedTextColor : '#FFFFFF',
          },
          isFocused && styles.labelTextFocused,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    minWidth: 130,
    maxWidth: 220,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginVertical: 4,
  },
  cardFocused: {
    transform: [{ scale: 1.06 }],
    elevation: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    borderWidth: 2.5,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  labelTextFocused: {
    fontWeight: '900',
  },
});
