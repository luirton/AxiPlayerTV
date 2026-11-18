import React, { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface TVBackButtonProps {
  onPress: () => void;
  label?: string;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const TVBackButton: React.FC<TVBackButtonProps> = ({
  onPress,
  label = 'Voltar',
  hasTVPreferredFocus = false,
  style,
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
        styles.button,
        isFocused && styles.focused,
        style,
      ]}
    >
      <Ionicons
        name="arrow-back"
        size={18}
        color={isFocused ? '#000000' : '#FFFFFF'}
        style={styles.icon}
      />
      {label ? (
        <Text style={[styles.label, isFocused && styles.labelFocused]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 28, 48, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1E2845',
    alignSelf: 'flex-start',
  },
  focused: {
    borderColor: '#FFFFFF',
    backgroundColor: colors.primary, // #00E5FF (Cores do sistema)
    transform: [{ scale: Platform.isTV ? 1.08 : 1.04 }],
    elevation: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    zIndex: 10,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  labelFocused: {
    color: '#000000',
    fontWeight: '900',
  },
});
