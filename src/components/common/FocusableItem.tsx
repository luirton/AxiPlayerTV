import React, { useState } from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  StyleSheet,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';

interface FocusableItemProps extends Omit<PressableProps, 'style' | 'children'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  scaleOnFocus?: boolean;
}

export const FocusableItem: React.FC<FocusableItemProps> = ({
  children,
  style,
  focusedStyle,
  scaleOnFocus = true,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <Pressable
      focusable={true}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={({ pressed }) => [
        style,
        isFocused && styles.defaultFocused,
        isFocused && scaleOnFocus && styles.scaled,
        isFocused && focusedStyle,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  defaultFocused: {
    borderColor: colors.focusRing,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  scaled: {
    transform: [{ scale: Platform.isTV ? 1.05 : 1.02 }],
  },
});
