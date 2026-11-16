import React, { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface FocusableButtonProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: 'primary' | 'secondary' | 'danger';
  hasTVPreferredFocus?: boolean;
}

export const FocusableButton: React.FC<FocusableButtonProps> = ({
  label,
  icon,
  onPress,
  style,
  textStyle,
  variant = 'primary',
  hasTVPreferredFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getGradientColors = (): [string, string] => {
    if (variant === 'danger') {
      return isFocused ? ['#FF4444', '#CC0000'] : ['#880000', '#550000'];
    }
    if (variant === 'secondary') {
      return isFocused ? ['#333333', '#444444'] : ['#1F1F1F', '#181818'];
    }
    // primary
    return isFocused
      ? [colors.primary, colors.secondary]
      : ['#007791', '#7B1FA2'];
  };

  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.container,
        isFocused && styles.focused,
        style,
      ]}
    >
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color="#FFFFFF"
            style={styles.icon}
          />
        )}
        <Text style={[styles.label, textStyle]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focused: {
    borderColor: colors.focusRing,
    transform: [{ scale: Platform.isTV ? 1.06 : 1.03 }],
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
