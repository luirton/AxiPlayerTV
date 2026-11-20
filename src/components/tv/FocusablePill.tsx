import React, { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface FocusablePillProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  badge?: string | number;
  isSelected?: boolean;
  onPress: () => void;
  onFocus?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: 'category' | 'sort' | 'tab' | 'action';
  activeColor?: string;
}

export const FocusablePill: React.FC<FocusablePillProps> = ({
  label,
  icon,
  iconColor,
  badge,
  isSelected = false,
  onPress,
  onFocus,
  hasTVPreferredFocus = false,
  style,
  textStyle,
  variant = 'category',
  activeColor,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  // Cores de fundo e texto seguindo o padrão de foco e seleção Axi TV
  const getBackgroundColor = () => {
    if (isFocused) {
      return colors.primary; // #00E5FF sólido quando focado pelo D-Pad
    }
    if (isSelected) {
      if (activeColor) return activeColor;
      return 'rgba(0, 229, 255, 0.16)'; // Fundo sutil para o item selecionado
    }
    return '#151C30';
  };

  const getBorderColor = () => {
    if (isFocused) {
      return '#FFFFFF'; // Borda branca sólida 2.5px de alto contraste no foco
    }
    if (isSelected) {
      return colors.primary; // Borda cyan marcando a seleção
    }
    return '#1E2845';
  };

  const getTextColor = () => {
    if (isFocused) {
      return '#070A12'; // Preto de alto contraste sobre o fundo Neon Cyan focado
    }
    if (isSelected) {
      return colors.primary; // Texto Cyan no item selecionado
    }
    return '#CBD5E1';
  };

  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={onPress}
      style={[
        styles.pill,
        variant === 'tab' && styles.tabPill,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        },
        isFocused && styles.pillFocused,
        isSelected && styles.pillSelected,
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {icon && (
          <Ionicons
            name={icon}
            size={14}
            color={iconColor || (isFocused ? '#070A12' : isSelected ? colors.primary : '#8E8E93')}
            style={styles.icon}
          />
        )}
        <Text
          style={[
            styles.label,
            { color: getTextColor() },
            (isSelected || isFocused) && styles.labelActive,
            textStyle,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {badge !== undefined && (
          <View
            style={[
              styles.badge,
              isFocused && styles.badgeFocused,
              isSelected && styles.badgeSelected,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                (isFocused || isSelected) && { color: colors.primary },
              ]}
            >
              {badge}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tabPill: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  pillFocused: {
    borderWidth: 2.5,
    transform: [{ scale: Platform.isTV ? 1.08 : 1.05 }],
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    zIndex: 10,
  },
  pillSelected: {
    borderWidth: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelActive: {
    fontWeight: '900',
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgeFocused: {
    backgroundColor: '#070A12',
  },
  badgeSelected: {
    backgroundColor: '#070A12',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
