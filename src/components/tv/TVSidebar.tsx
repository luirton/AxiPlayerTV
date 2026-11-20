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
import { Image } from 'expo-image';
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
  { id: 'settings', label: 'Configurações', icon: 'settings-sharp', route: '/(tv)/settings' },
];

export const TVSidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const widthAnim = useRef(new Animated.Value(72)).current;

  const handleSidebarFocus = () => {
    setIsExpanded(true);
    Animated.timing(widthAnim, {
      toValue: 220,
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
        <Image
          source={require('../../../assets/emblem_transparent.png')}
          style={styles.brandEmblem}
          contentFit="contain"
        />
        {isExpanded && (
          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>
              AXI<Text style={styles.brandTvText}>TV</Text>
            </Text>
            <Text style={styles.brandSubtitle}>EDITION</Text>
          </View>
        )}
      </View>

      {/* Navigation Items */}
      <View style={styles.menuList}>
        {MENU_ITEMS.map((item) => {
          const routeSuffix = item.route.replace('/(tv)', '');
          const isActive =
            (pathname && routeSuffix && pathname.includes(routeSuffix)) ||
            (item.id === 'home' && (pathname === '/' || pathname === '/(tv)/home' || pathname === '/home'));
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
        <Ionicons name="wifi" size={16} color="#00E676" />
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
        color={isFocused ? colors.focusRing : isActive ? colors.primary : '#9AA4BC'}
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
    backgroundColor: '#070A12',
    borderRightWidth: 1,
    borderRightColor: '#1B2338',
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    zIndex: 100,
  },
  expandedContainer: {
    backgroundColor: 'rgba(7, 10, 18, 0.98)',
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
    marginBottom: 20,
    width: '100%',
    paddingLeft: 4,
  },
  brandEmblem: {
    width: 38,
    height: 38,
  },
  brandTextContainer: {
    marginLeft: 12,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandTvText: {
    color: colors.primaryAmber,
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
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  itemFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(0, 229, 255, 0.22)',
    transform: [{ scale: Platform.isTV ? 1.05 : 1.02 }],
  },
  itemLabel: {
    color: '#9AA4BC',
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
    color: '#00E676',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
