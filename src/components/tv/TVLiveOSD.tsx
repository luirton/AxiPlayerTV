import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { IptvCategory, LiveChannel, EpgProgram } from '../../types/iptv';

interface TVLiveOSDProps {
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
  categories: IptvCategory[];
  selectedCategory: IptvCategory | null;
  onSelectCategory: (category: IptvCategory) => void;
  channels: LiveChannel[];
  activeChannel: LiveChannel | null;
  onSelectChannel: (channel: LiveChannel) => void;
  favoriteIds: number[];
  onToggleFavorite: (channel: LiveChannel) => void;
  isZappingBannerOpen: boolean;
  currentEpg?: EpgProgram | null;
  onExitToHome: () => void;
  onPreviousChannel?: () => void;
  onNextChannel?: () => void;
  onOpenDrawer?: () => void;
}

export const TVLiveOSD: React.FC<TVLiveOSDProps> = ({
  isDrawerOpen,
  onCloseDrawer,
  categories,
  selectedCategory,
  onSelectCategory,
  channels,
  activeChannel,
  onSelectChannel,
  favoriteIds,
  onToggleFavorite,
  isZappingBannerOpen,
  currentEpg,
  onExitToHome,
  onPreviousChannel,
  onNextChannel,
  onOpenDrawer,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Split Drawer (Guia Completo Translúcido)
  if (isDrawerOpen) {
    return (
      <View style={styles.drawerOverlay} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(8, 8, 12, 0.96)', 'rgba(12, 12, 16, 0.92)']}
          style={styles.drawerContainer}
        >
          {/* Top Bar inside Drawer */}
          <View style={styles.drawerTopBar}>
            <View style={styles.drawerBrand}>
              <View style={styles.liveIndicatorDot} />
              <Text style={styles.drawerTitle}>GUIA DE CANAIS AO VIVO</Text>
            </View>

            <View style={styles.topActions}>
              <OSDActionButton
                icon="arrow-back"
                label="Tela Cheia (Voltar)"
                onPress={onCloseDrawer}
              />
              <OSDActionButton
                icon="home-outline"
                label="Menu Principal"
                variant="accent"
                onPress={onExitToHome}
              />
            </View>
          </View>

          {/* Split Content: Categorias (Esquerda) e Canais (Direita) */}
          <View style={styles.splitContent}>
            {/* Coluna 1: Categorias */}
            <View style={styles.categoryColumn}>
              <View style={styles.columnHeader}>
                <Ionicons name="folder-open" size={15} color={colors.primary} />
                <Text style={styles.columnTitle}>CATEGORIAS ({categories.length})</Text>
              </View>

              <FlatList
                data={categories}
                keyExtractor={(item) => item.category_id}
                showsVerticalScrollIndicator={false}
                initialNumToRender={14}
                maxToRenderPerBatch={16}
                windowSize={7}
                renderItem={({ item }) => {
                  const isSelected = selectedCategory?.category_id === item.category_id;
                  const isFavCategory = item.category_id === 'favorites';
                  return (
                    <CategoryListItem
                      title={item.category_name}
                      isSelected={isSelected}
                      isFavoriteTab={isFavCategory}
                      onPress={() => onSelectCategory(item)}
                    />
                  );
                }}
              />
            </View>

            {/* Coluna 2: Canais */}
            <View style={styles.channelColumn}>
              <View style={styles.columnHeader}>
                <Ionicons name="tv" size={15} color={colors.primary} />
                <Text style={styles.columnTitle} numberOfLines={1}>
                  {selectedCategory?.category_name.toUpperCase() || 'CANAIS'} ({channels.length})
                </Text>
              </View>

              <FlatList
                data={channels}
                keyExtractor={(item) => String(item.stream_id)}
                showsVerticalScrollIndicator={false}
                initialNumToRender={15}
                maxToRenderPerBatch={20}
                windowSize={9}
                renderItem={({ item, index }) => {
                  const isPlaying = activeChannel?.stream_id === item.stream_id;
                  const isFav = favoriteIds.includes(item.stream_id);
                  return (
                    <ChannelListItem
                      num={index + 1}
                      channel={item}
                      isPlaying={isPlaying}
                      isFavorite={isFav}
                      onPress={() => onSelectChannel(item)}
                      onToggleFavorite={() => onToggleFavorite(item)}
                    />
                  );
                }}
              />
            </View>

            {/* Coluna 3: Detalhes Rápidos do Canal em Foco / EPG */}
            <View style={styles.detailsColumn}>
              {activeChannel ? (
                <View style={styles.activeChannelPreview}>
                  <View style={styles.previewLogoBox}>
                    {activeChannel.stream_icon ? (
                      <Image
                        source={{ uri: activeChannel.stream_icon }}
                        style={styles.previewLogoImage}
                        contentFit="contain"
                      />
                    ) : (
                      <Ionicons name="tv-outline" size={48} color="#666" />
                    )}
                    <View style={styles.previewNowPlayingBadge}>
                      <Ionicons name="play" size={12} color="#FFF" />
                      <Text style={styles.previewNowPlayingText}>TOCANDO AGORA</Text>
                    </View>
                  </View>

                  <Text style={styles.previewChannelTitle} numberOfLines={2}>
                    {activeChannel.name}
                  </Text>

                  <View style={styles.epgBox}>
                    <View style={styles.epgLiveRow}>
                      <View style={styles.badgeLiveSmall}>
                        <Text style={styles.badgeLiveSmallText}>AO VIVO</Text>
                      </View>
                      <Text style={styles.epgTimeLabel}>
                        {currentEpg ? `${currentEpg.start} - ${currentEpg.end}` : 'Transmissão em Direto'}
                      </Text>
                    </View>

                    <Text style={styles.epgProgramTitle} numberOfLines={2}>
                      {currentEpg?.title || 'Programação Ao Vivo Sem Guia Detalhado'}
                    </Text>

                    {currentEpg?.description ? (
                      <Text style={styles.epgProgramDesc} numberOfLines={4}>
                        {currentEpg.description}
                      </Text>
                    ) : (
                      <Text style={styles.epgProgramDesc} numberOfLines={3}>
                        Use as setas Cima / Baixo no controle remoto para zapping rápido entre canais.
                      </Text>
                    )}
                  </View>

                  {/* Remote Navigation Shortcuts */}
                  <View style={styles.remoteTipsBox}>
                    <Text style={styles.remoteTipsTitle}>Controle Remoto</Text>
                    <Text style={styles.remoteTipText}>• OK: Reproduzir canal selecionado</Text>
                    <Text style={styles.remoteTipText}>• ⭐: Favoritar canal</Text>
                    <Text style={styles.remoteTipText}>• Voltar: Fechar guia e expandir vídeo</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyDetails}>
                  <Text style={styles.emptyText}>Nenhum canal ativo</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Zapping Banner Inferior (quando a gaveta está fechada e o canal é trocado)
  if (isZappingBannerOpen && activeChannel) {
    const isFav = favoriteIds.includes(activeChannel.stream_id);

    return (
      <View style={styles.zappingContainer} pointerEvents="box-none">
        <LinearGradient
          colors={['transparent', 'rgba(6, 6, 8, 0.95)']}
          style={styles.zappingGradient}
        >
          <View style={styles.zappingCard}>
            {/* Logo do Canal */}
            <View style={styles.zappingLogoContainer}>
              {activeChannel.stream_icon ? (
                <Image
                  source={{ uri: activeChannel.stream_icon }}
                  style={styles.zappingLogo}
                  contentFit="contain"
                />
              ) : (
                <Ionicons name="tv" size={32} color="#FFF" />
              )}
            </View>

            {/* Informações Principais */}
            <View style={styles.zappingInfo}>
              <View style={styles.zappingHeaderRow}>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.livePillText}>AO VIVO</Text>
                </View>
                <Text style={styles.channelQualityBadge}>FHD 1080P</Text>
                {isFav && <Ionicons name="star" size={14} color="#FFA000" style={{ marginLeft: 6 }} />}
              </View>

              <Text style={styles.zappingChannelName} numberOfLines={1}>
                {activeChannel.name}
              </Text>

              {/* Programa Atual / EPG */}
              <View style={styles.zappingEpgRow}>
                <Ionicons name="play-forward-outline" size={13} color="#FFA000" />
                <Text style={styles.zappingEpgTitle} numberOfLines={1}>
                  {currentEpg?.title || 'Programação Ao Vivo Contínua'}
                </Text>
                {currentEpg?.end && (
                  <Text style={styles.zappingEpgTime}>• até {currentEpg.end}</Text>
                )}
              </View>
            </View>

            {/* Botões rápidos D-Pad */}
            <View style={styles.zappingActions}>
              <OSDActionButton
                icon="chevron-up"
                label="Anterior (▲)"
                variant="zapping"
                onPress={onPreviousChannel}
              />
              <OSDActionButton
                icon="list"
                label="Guia (OK)"
                variant="zapping"
                hasPreferredFocus={true}
                onPress={onOpenDrawer}
              />
              <OSDActionButton
                icon={isFav ? 'star' : 'star-outline'}
                iconColor={isFav ? '#FFA000' : '#FFF'}
                label="Favorito"
                variant="zapping"
                onPress={() => onToggleFavorite(activeChannel)}
              />
              <OSDActionButton
                icon="chevron-down"
                label="Próximo (▼)"
                variant="zapping"
                onPress={onNextChannel}
              />
            </View>
          </View>

          {/* Dicas de Zapping */}
          <Text style={styles.zappingDpadHint}>
            ▲ Canal Anterior • ▼ Próximo Canal • OK Abrir Menu Completo • Voltar Sair
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return null;
};

// Item de Categoria
function CategoryListItem({
  title,
  isSelected,
  isFavoriteTab,
  onPress,
}: {
  title: string;
  isSelected: boolean;
  isFavoriteTab?: boolean;
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
        isFocused && styles.focusedItem,
      ]}
    >
      <Ionicons
        name={isFavoriteTab ? 'star' : 'film-outline'}
        size={14}
        color={isFavoriteTab ? '#FFA000' : isSelected || isFocused ? colors.primary : '#8E8E93'}
        style={{ marginRight: 8 }}
      />
      <Text
        style={[
          styles.catItemText,
          isSelected && styles.catItemTextSelected,
          isFocused && styles.focusedItemText,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// Item de Canal
function ChannelListItem({
  num,
  channel,
  isPlaying,
  isFavorite,
  onPress,
  onToggleFavorite,
}: {
  num: number;
  channel: LiveChannel;
  isPlaying: boolean;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.channelItem,
        isPlaying && styles.channelItemPlaying,
        isFocused && styles.focusedItem,
      ]}
    >
      <Text style={styles.channelNumText}>{String(num).padStart(3, '0')}</Text>

      {channel.stream_icon ? (
        <Image
          source={{ uri: channel.stream_icon }}
          style={styles.channelItemLogo}
          contentFit="contain"
        />
      ) : (
        <View style={styles.channelItemLogoPlaceholder}>
          <Ionicons name="tv" size={13} color="#888" />
        </View>
      )}

      <Text
        style={[
          styles.channelItemName,
          isPlaying && styles.channelItemNamePlaying,
          isFocused && styles.focusedItemText,
        ]}
        numberOfLines={1}
      >
        {channel.name}
      </Text>

      {isPlaying && (
        <View style={styles.playingBadgePill}>
          <Ionicons name="volume-high" size={13} color="#FFF" />
        </View>
      )}

      {isFavorite && (
        <Ionicons name="star" size={14} color="#FFA000" style={{ marginLeft: 6 }} />
      )}
    </Pressable>
  );
}

function OSDActionButton({
  onPress,
  icon,
  iconColor = '#FFF',
  label,
  variant = 'default',
  hasPreferredFocus = false,
}: {
  onPress?: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  variant?: 'default' | 'accent' | 'zapping';
  hasPreferredFocus?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasPreferredFocus}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        variant === 'zapping'
          ? styles.quickActionBtn
          : variant === 'accent'
          ? styles.exitBtn
          : styles.closeDrawerBtn,
        isFocused && styles.focusedButton,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={isFocused ? '#000000' : iconColor}
      />
      <Text
        style={[
          variant === 'accent'
            ? styles.exitBtnText
            : variant === 'zapping'
            ? styles.quickActionText
            : styles.closeDrawerBtnText,
          isFocused && { color: '#000000', fontWeight: '900' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Overlay & Drawer
  drawerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 99,
  },
  drawerContainer: {
    width: '68%',
    height: '100%',
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: '#25252A',
  },
  drawerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E24',
  },
  drawerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  drawerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  closeDrawerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#202026',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  closeDrawerBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 106, 0, 0.2)',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  exitBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
  },

  // Split Content
  splitContent: {
    flex: 1,
    flexDirection: 'row',
  },
  categoryColumn: {
    width: '32%',
    backgroundColor: '#0D0D11',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  channelColumn: {
    width: '40%',
    backgroundColor: '#0D0D11',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  detailsColumn: {
    flex: 1,
    backgroundColor: '#0D0D11',
    borderRadius: 8,
    padding: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A20',
  },
  columnTitle: {
    color: '#A0A0A5',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.4,
  },

  // Category Item
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginVertical: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catItemSelected: {
    backgroundColor: 'rgba(255, 106, 0, 0.16)',
  },
  catItemText: {
    color: '#909096',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  catItemTextSelected: {
    color: colors.primary,
    fontWeight: 'bold',
  },

  // Channel Item
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginVertical: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  channelItemPlaying: {
    backgroundColor: 'rgba(255, 160, 0, 0.2)',
    borderColor: 'rgba(255, 160, 0, 0.4)',
  },
  channelNumText: {
    color: '#606066',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: 6,
  },
  channelItemLogo: {
    width: 28,
    height: 20,
    borderRadius: 3,
    marginRight: 8,
  },
  channelItemLogoPlaceholder: {
    width: 28,
    height: 20,
    borderRadius: 3,
    backgroundColor: '#1E1E24',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  channelItemName: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  channelItemNamePlaying: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  playingBadgePill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },

  // Focus states
  focusedItem: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(0, 229, 255, 0.22)',
  },
  focusedItemText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  focusedButton: {
    borderColor: '#FFFFFF',
    backgroundColor: colors.primary, // #00E5FF (Cores do sistema Axi)
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
    elevation: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },

  // Details Column
  activeChannelPreview: {
    flex: 1,
  },
  previewLogoBox: {
    height: 100,
    backgroundColor: '#141418',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  previewLogoImage: {
    width: 90,
    height: 60,
  },
  previewNowPlayingBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 45, 39, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewNowPlayingText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  previewChannelTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  epgBox: {
    backgroundColor: '#141418',
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  epgLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeLiveSmall: {
    backgroundColor: '#E52D27',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeLiveSmallText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  epgTimeLabel: {
    color: '#8E8E93',
    fontSize: 10,
  },
  epgProgramTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  epgProgramDesc: {
    color: '#8E8E93',
    fontSize: 11,
    lineHeight: 15,
  },
  remoteTipsBox: {
    marginTop: 'auto',
    backgroundColor: '#111116',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E1E24',
  },
  remoteTipsTitle: {
    color: colors.primaryAmber,
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  remoteTipText: {
    color: '#7E7E84',
    fontSize: 10,
    marginVertical: 1,
  },
  emptyDetails: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 12,
  },

  // Zapping Banner Inferior
  zappingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 90,
  },
  zappingGradient: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 20,
  },
  zappingCard: {
    backgroundColor: 'rgba(16, 16, 22, 0.94)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2A2A35',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  zappingLogoContainer: {
    width: 68,
    height: 48,
    backgroundColor: '#0A0A0E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  zappingLogo: {
    width: 58,
    height: 38,
  },
  zappingInfo: {
    flex: 1,
  },
  zappingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E52D27',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
    marginRight: 4,
  },
  livePillText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  channelQualityBadge: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#202026',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  zappingChannelName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  zappingEpgRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zappingEpgTitle: {
    color: '#D0D0D5',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  zappingEpgTime: {
    color: '#8E8E93',
    fontSize: 11,
    marginLeft: 6,
  },
  zappingActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 16,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#24242E',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  quickActionText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  zappingDpadHint: {
    textAlign: 'center',
    color: '#707076',
    fontSize: 11,
    marginTop: 8,
    letterSpacing: 0.3,
  },
});
