import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';
import { Category, LiveStream } from '../../src/types/iptv';
import { useRouter } from 'expo-router';

export default function TVLiveScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [channels, setChannels] = useState<LiveStream[]>([]);
  const [activeChannel, setActiveChannel] = useState<LiveStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLiveCategories();
  }, []);

  const loadLiveCategories = async () => {
    try {
      setIsLoading(true);
      const profile = await storage.getActiveProfile();
      if (!profile) return;
      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

      const cats = await xtreamClient.getLiveCategories();
      setCategories(cats);

      if (cats.length > 0) {
        setSelectedCategory(cats[0]);
        loadChannels(cats[0].category_id);
      }
    } catch (err) {
      console.error('Error loading live categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChannels = async (categoryId: string) => {
    try {
      const liveList = await xtreamClient.getLiveStreams(categoryId);
      setChannels(liveList);
      if (liveList.length > 0 && !activeChannel) {
        setActiveChannel(liveList[0]);
      }
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  };

  const handleCategorySelect = (cat: Category) => {
    setSelectedCategory(cat);
    loadChannels(cat.category_id);
  };

  const handlePlayChannel = (channel: LiveStream) => {
    setActiveChannel(channel);
    router.push({
      pathname: '/player/[id]',
      params: { id: String(channel.stream_id), type: 'live', name: channel.name },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando Guia de TV ao Vivo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Coluna 1: Categorias de TV */}
      <View style={styles.categoryColumn}>
        <View style={styles.columnHeader}>
          <Ionicons name="list" size={18} color={colors.primary} />
          <Text style={styles.columnTitle}>CATEGORIAS</Text>
        </View>

        <FlatList
          data={categories}
          keyExtractor={(item) => item.category_id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = selectedCategory?.category_id === item.category_id;
            return (
              <CategoryItem
                title={item.category_name}
                isSelected={isSelected}
                onPress={() => handleCategorySelect(item)}
              />
            );
          }}
        />
      </View>

      {/* Coluna 2: Canais da Categoria Selecionada */}
      <View style={styles.channelColumn}>
        <View style={styles.columnHeader}>
          <Ionicons name="tv-outline" size={18} color={colors.primary} />
          <Text style={styles.columnTitle}>
            {selectedCategory?.category_name.toUpperCase() || 'CANAIS'} ({channels.length})
          </Text>
        </View>

        <FlatList
          data={channels}
          keyExtractor={(item) => String(item.stream_id)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const isActive = activeChannel?.stream_id === item.stream_id;
            return (
              <ChannelItem
                num={index + 1}
                name={item.name}
                logo={item.stream_icon}
                isActive={isActive}
                onPress={() => handlePlayChannel(item)}
              />
            );
          }}
        />
      </View>

      {/* Lado Direito: Preview do Canal Selecionado e Detalhes EPG */}
      <View style={styles.previewColumn}>
        {activeChannel ? (
          <View style={styles.previewCard}>
            <View style={styles.previewVideoPlaceholder}>
              {activeChannel.stream_icon ? (
                <Image
                  source={{ uri: activeChannel.stream_icon }}
                  style={styles.previewLogo}
                  contentFit="contain"
                />
              ) : (
                <Ionicons name="play-circle-outline" size={64} color="#555" />
              )}
              <Pressable
                style={styles.openFullButton}
                onPress={() => handlePlayChannel(activeChannel)}
              >
                <Ionicons name="expand" size={16} color="#FFF" />
                <Text style={styles.openFullText}>Assistir em Tela Cheia</Text>
              </Pressable>
            </View>

            <View style={styles.previewInfo}>
              <Text style={styles.previewChannelName} numberOfLines={2}>
                {activeChannel.name}
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.badgeLive}>
                  <Text style={styles.badgeLiveText}>AO VIVO</Text>
                </View>
                <Text style={styles.epgTime}>Agora</Text>
              </View>
              <Text style={styles.epgTitle}>Programação ao vivo em tempo real</Text>
              <Text style={styles.epgDesc}>
                Aperte OK no controle para abrir em tela cheia com troca rápida de canais (Zapping Cima/Baixo).
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.centerPreview}>
            <Text style={styles.selectChannelText}>Selecione um canal para assistir</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function CategoryItem({
  title,
  isSelected,
  onPress,
}: {
  title: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.catItem,
        isSelected && styles.catItemSelected,
        isFocused && styles.itemFocused,
      ]}
    >
      <Text
        style={[
          styles.catItemText,
          isSelected && styles.catItemTextSelected,
          isFocused && styles.itemTextFocused,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ChannelItem({
  num,
  name,
  logo,
  isActive,
  onPress,
}: {
  num: number;
  name: string;
  logo?: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.chanItem,
        isActive && styles.chanItemActive,
        isFocused && styles.itemFocused,
      ]}
    >
      <Text style={styles.chanNum}>{String(num).padStart(3, '0')}</Text>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.chanLogo} contentFit="contain" />
      ) : (
        <View style={styles.chanLogoPlaceholder}>
          <Ionicons name="tv" size={14} color="#8E8E93" />
        </View>
      )}
      <Text
        style={[
          styles.chanName,
          isActive && styles.chanNameActive,
          isFocused && styles.itemTextFocused,
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#050505',
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 16,
    fontSize: 14,
  },
  categoryColumn: {
    width: 220,
    backgroundColor: '#0E0E12',
    borderRadius: 10,
    padding: 10,
    marginRight: 12,
  },
  channelColumn: {
    width: 280,
    backgroundColor: '#0E0E12',
    borderRadius: 10,
    padding: 10,
    marginRight: 12,
  },
  previewColumn: {
    flex: 1,
    backgroundColor: '#0E0E12',
    borderRadius: 10,
    padding: 16,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E24',
  },
  columnTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  catItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginVertical: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catItemSelected: {
    backgroundColor: 'rgba(255, 106, 0, 0.15)',
  },
  catItemText: {
    color: '#A0A0A5',
    fontSize: 13,
    fontWeight: '600',
  },
  catItemTextSelected: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  chanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginVertical: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chanItemActive: {
    backgroundColor: 'rgba(255, 160, 0, 0.18)',
  },
  chanNum: {
    color: '#66666B',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: 8,
  },
  chanLogo: {
    width: 32,
    height: 24,
    borderRadius: 4,
    marginRight: 10,
  },
  chanLogoPlaceholder: {
    width: 32,
    height: 24,
    backgroundColor: '#1C1C22',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chanName: {
    color: '#D0D0D5',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  chanNameActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  itemFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(255, 160, 0, 0.25)',
  },
  itemTextFocused: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  previewCard: {
    flex: 1,
  },
  previewVideoPlaceholder: {
    height: 240,
    backgroundColor: '#16161C',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  previewLogo: {
    width: 120,
    height: 80,
  },
  openFullButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  openFullText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  previewInfo: {
    marginTop: 16,
  },
  previewChannelName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  badgeLive: {
    backgroundColor: '#E52D27',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeLiveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  epgTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  epgTitle: {
    color: '#E0E0E5',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  epgDesc: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 18,
  },
  centerPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectChannelText: {
    color: '#666',
    fontSize: 14,
  },
});
