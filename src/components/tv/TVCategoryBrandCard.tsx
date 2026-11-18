import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';

interface TVCategoryBrandCardProps {
  label: string;
  accentColor: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}

export const TVCategoryBrandCard: React.FC<TVCategoryBrandCardProps> = ({
  label,
  accentColor,
  onPress,
  hasTVPreferredFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

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
          backgroundColor: isFocused ? 'rgba(255, 255, 255, 0.12)' : '#070B14',
          shadowColor: accentColor,
        },
        isFocused && styles.cardFocused,
      ]}
    >
      <Text
        style={[
          styles.labelText,
          {
            color: isFocused ? '#FFFFFF' : accentColor,
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
    minWidth: 140,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginVertical: 4,
  },
  cardFocused: {
    transform: [{ scale: 1.08 }],
    elevation: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    borderWidth: 2.5,
  },
  labelText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  labelTextFocused: {
    fontWeight: '900',
  },
});
