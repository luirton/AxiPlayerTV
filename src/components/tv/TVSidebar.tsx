import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'search', label: 'Buscar', icon: 'search', route: '/(tv)/search' },
  { id: 'home', label: 'Início', icon: 'home', route: '/(tv)/home' },
  { id: 'live', label: 'TV Ao Vivo', icon: 'tv', route: '/(tv)/live' },
  { id: 'movies', label: 'Filmes', icon: 'film', route: '/(tv)/movies' },
  { id: 'series', label: 'Séries', icon: 'albums', route: '/(tv)/series' },
  { id: 'settings', label: 'Ajustes', icon: 'settings-sharp', route: '/(tv)/settings' },
];

export const TVSidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const widthAnim = useRef(new Animated.Value(72)).current;

  const handleSidebarFocus = () => {
    setIsExpanded(true);
    Animated.timing(widthAnim, {
      toValue: 210,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleSidebarBlur = () => {
    setIsExpanded(false);
    Animated.timing(widthAnim, {
      toValue: 72,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { width: widthAnim },
        isExpanded && styles.expandedContainer,
      ]}
    >
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <View style={styles.brandIconContainer}>
          <Text style={styles.brandLetter}>A</Text>
        </View>
        {isExpanded && (
          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>AXI PLAYER</Text>
            <Text style={styles.brandSubtitle}>TV EDITION</Text>
          </View>
        )}
      </View>

      {/* Navigation Items */}
      <View style={styles.menuList}>
        {MENU_ITEMS.map((item) => {
          const isActive = pathname.includes(item.route.replace('/(tv)', ''));
          return (
            <SidebarItem
              key={item.id}
              item={item}
              isActive={isActive}
              isExpanded={isExpanded}
              onPress={() => router.push(item.route as any)}
              onFocus={handleSidebarFocus}
              onBlur={handleSidebarBlur}
            />
          );
        })}
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Ionicons name="wifi" size={16} color="#4CD964" />
        {isExpanded && (
          <Text style={styles.footerText} numberOfLines={1}>
            Online • FHD
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

interface SidebarItemProps {
  item: MenuItem;
  isActive: boolean;
  isExpanded: boolean;
  onPress: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  item,
  isActive,
  isExpanded,
  onPress,
  onFocus,
  onBlur,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => {
        setIsFocused(true);
        onFocus();
      }}
      onBlur={() => {
        setIsFocused(false);
        onBlur();
      }}
      onPress={onPress}
      style={[
        styles.itemContainer,
        isActive && styles.itemActive,
        isFocused && styles.itemFocused,
      ]}
    >
      <Ionicons
        name={item.icon}
        size={22}
        color={isFocused ? colors.focusRing : isActive ? colors.primary : '#8E8E93'}
      />
      {isExpanded && (
        <Text
          style={[
            styles.itemLabel,
            isActive && styles.itemLabelActive,
            isFocused && styles.itemLabelFocused,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    height: '100%',
    backgroundColor: '#0A0A0C',
    borderRightWidth: 1,
    borderRightColor: '#1A1A1E',
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    zIndex: 100,
  },
  expandedContainer: {
    backgroundColor: 'rgba(10, 10, 12, 0.98)',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
    paddingLeft: 4,
  },
  brandIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandLetter: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 20,
  },
  brandTextContainer: {
    marginLeft: 12,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  menuList: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemActive: {
    backgroundColor: 'rgba(255, 106, 0, 0.12)',
  },
  itemFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(255, 160, 0, 0.2)',
    transform: [{ scale: Platform.isTV ? 1.05 : 1.02 }],
  },
  itemLabel: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 14,
  },
  itemLabelActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  itemLabelFocused: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
  },
  footerText: {
    color: '#4CD964',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
