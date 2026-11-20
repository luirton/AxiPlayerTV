import React, { useState, useEffect, useRef } from 'react';
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
  isOverlayOpen: boolean;
  onCloseOverlay: () => void;
  currentEpg?: EpgProgram | null;
  epgList?: EpgProgram[];
  onExitToHome: () => void;
  onPreviousChannel?: () => void;
  onNextChannel?: () => void;
  onOpenDrawer?: () => void;
  isPlaying?: boolean;
  onTogglePlayPause?: () => void;
  contentFit?: 'contain' | 'cover' | 'fill';
  onToggleContentFit?: () => void;
  onResetOverlayTimer?: () => void;
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
  isOverlayOpen,
  onCloseOverlay,
  currentEpg,
  epgList = [],
  onExitToHome,
  onPreviousChannel,
  onNextChannel,
  onOpenDrawer,
  isPlaying = true,
  onTogglePlayPause,
  contentFit = 'contain',
  onToggleContentFit,
  onResetOverlayTimer,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showEpgModal, setShowEpgModal] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<LiveChannel | null>(activeChannel);
  const channelsListRef = useRef<FlatList>(null);
  const categoryListRef = useRef<FlatList>(null);

  const activeChannelIndex = channels.findIndex(
    (c) => String(c.stream_id) === String(activeChannel?.stream_id)
  );

  useEffect(() => {
    if (activeChannel) {
      setPreviewChannel(activeChannel);
    }
  }, [activeChannel]);

  // Mantém a lista de canais e categorias sempre posicionadas no canal e categoria ativos
  useEffect(() => {
    if (isDrawerOpen && activeChannel && channels.length > 0) {
      const chanIdx = channels.findIndex(
        (c) => String(c.stream_id) === String(activeChannel.stream_id)
      );
      if (chanIdx >= 0) {
        setPreviewChannel(activeChannel);
        const timer = setTimeout(() => {
          try {
            channelsListRef.current?.scrollToIndex({
              index: chanIdx,
              animated: false,
              viewPosition: 0.3,
            });
          } catch (e) {
            channelsListRef.current?.scrollToOffset({
              offset: Math.max(0, chanIdx * 48 - 100),
              animated: false,
            });
          }
        }, 80);
        return () => clearTimeout(timer);
      }
    }
  }, [isDrawerOpen, activeChannel, channels]);

  useEffect(() => {
    if (isDrawerOpen && selectedCategory && categories.length > 0) {
      const catIdx = categories.findIndex(
        (c) => String(c.category_id) === String(selectedCategory.category_id)
      );
      if (catIdx >= 0) {
        const timer = setTimeout(() => {
          try {
            categoryListRef.current?.scrollToIndex({
              index: catIdx,
              animated: false,
              viewPosition: 0.3,
            });
          } catch (e) {
            // ignore
          }
        }, 80);
        return () => clearTimeout(timer);
      }
    }
  }, [isDrawerOpen, selectedCategory, categories]);

  const targetChannel = previewChannel || activeChannel;
  const isTargetFav = targetChannel ? favoriteIds.includes(targetChannel.stream_id) : false;
  const isTargetPlaying = activeChannel?.stream_id === targetChannel?.stream_id;

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
                ref={categoryListRef}
                data={categories}
                keyExtractor={(item) => item.category_id}
                showsVerticalScrollIndicator={false}
                initialNumToRender={16}
                maxToRenderPerBatch={20}
                windowSize={9}
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
                ref={channelsListRef}
                data={channels}
                keyExtractor={(item) => String(item.stream_id)}
                showsVerticalScrollIndicator={false}
                initialScrollIndex={activeChannelIndex >= 0 ? activeChannelIndex : undefined}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    channelsListRef.current?.scrollToOffset({
                      offset: Math.max(0, info.index * 48 - 100),
                      animated: false,
                    });
                  }, 80);
                }}
                getItemLayout={(_, index) => ({
                  length: 48,
                  offset: 48 * index,
                  index,
                })}
                initialNumToRender={20}
                maxToRenderPerBatch={25}
                windowSize={11}
                renderItem={({ item, index }) => {
                  const isPlaying = String(activeChannel?.stream_id) === String(item.stream_id);
                  const isFav = favoriteIds.includes(item.stream_id);
                  return (
                    <ChannelListItem
                      num={index + 1}
                      channel={item}
                      isPlaying={isPlaying}
                      isFavorite={isFav}
                      hasPreferredFocus={isPlaying}
                      onPress={() => onSelectChannel(item)}
                      onFocusChannel={(chan) => setPreviewChannel(chan)}
                      onToggleFavorite={() => onToggleFavorite(item)}
                    />
                  );
                }}
              />
            </View>

            {/* Coluna 3: Detalhes Rápidos do Canal em Foco / EPG */}
            <View style={styles.detailsColumn}>
              {targetChannel ? (
                <View style={styles.activeChannelPreview}>
                  <View style={styles.previewLogoBox}>
                    {targetChannel.stream_icon ? (
                      <Image
                        source={{ uri: targetChannel.stream_icon }}
                        style={styles.previewLogoImage}
                        contentFit="contain"
                      />
                    ) : (
                      <Ionicons name="tv-outline" size={48} color="#666" />
                    )}
                    <View
                      style={[
                        styles.previewNowPlayingBadge,
                        !isTargetPlaying && { backgroundColor: 'rgba(0, 229, 255, 0.85)' },
                      ]}
                    >
                      <Ionicons name={isTargetPlaying ? 'play' : 'eye'} size={12} color="#FFF" />
                      <Text style={styles.previewNowPlayingText}>
                        {isTargetPlaying ? 'TOCANDO AGORA' : 'EM FOCO'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.previewChannelTitle} numberOfLines={2}>
                    {targetChannel.name}
                  </Text>

                  {/* Ações Rápidas no Guia: Favoritar & Sintonizar */}
                  <View style={styles.detailsActionsContainer}>
                    <OSDActionButton
                      icon={isTargetFav ? 'star' : 'star-outline'}
                      iconColor={isTargetFav ? '#FFA000' : '#FFFFFF'}
                      label={isTargetFav ? 'Remover dos Favoritos (⭐)' : 'Adicionar aos Favoritos (⭐)'}
                      variant="accent"
                      onPress={() => onToggleFavorite(targetChannel)}
                    />
                    <OSDActionButton
                      icon="play"
                      label="Sintonizar Canal (OK)"
                      onPress={() => onSelectChannel(targetChannel)}
                    />
                  </View>

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
                      <Text style={styles.epgProgramDesc} numberOfLines={3}>
                        {currentEpg.description}
                      </Text>
                    ) : (
                      <Text style={styles.epgProgramDesc} numberOfLines={2}>
                        Sintonize para acompanhar a transmissão ao vivo em alta definição.
                      </Text>
                    )}
                  </View>

                  {/* Remote Navigation Shortcuts */}
                  <View style={styles.remoteTipsBox}>
                    <Text style={styles.remoteTipsTitle}>Comandos Rápidos</Text>
                    <Text style={styles.remoteTipText}>• OK: Sintonizar e ver em tela cheia</Text>
                    <Text style={styles.remoteTipText}>• Segurar OK: Favoritar / Desfavoritar</Text>
                    <Text style={styles.remoteTipText}>• Seta Direita: Acessar botões de detalhes</Text>
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

  const isFav = activeChannel ? favoriteIds.includes(activeChannel.stream_id) : false;

  return (
    <>
      {/* Overlay do Player de TV ao Vivo (Conforme imagens de referência) */}
      {isOverlayOpen && !isDrawerOpen && activeChannel && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          {/* 1. Barra Superior com Informações do Canal em Fundo Escuro (Imagem 4) */}
          <LinearGradient
            colors={['rgba(5, 7, 12, 0.95)', 'rgba(5, 7, 12, 0.65)', 'transparent']}
            style={styles.overlayTopGradient}
            pointerEvents="box-none"
          >
            <View style={styles.overlayTopBar}>
              {/* Informações do Canal com Fundo Escuro de Alta Legibilidade (Imagem 4) */}
              <View style={styles.channelInfoDarkCard}>
                <View style={styles.channelInfoHeaderRow}>
                  <View style={styles.liveIndicatorDot} />
                  <Text style={styles.liveIndicatorText}>AO VIVO</Text>
                </View>
                <Text style={styles.overlayChannelName} numberOfLines={1}>
                  {activeChannel.name}
                </Text>
                <Text style={styles.overlaySubtitle} numberOfLines={2}>
                  {currentEpg?.title ? `Ao vivo • ${currentEpg.title}` : 'Programação Ao Vivo Contínua'}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* 2. Barra Inferior com Gradiente: Linha Laranja + 3 Pílulas + Marca d'Água */}
          <LinearGradient
            colors={['transparent', 'rgba(5, 7, 12, 0.75)', 'rgba(5, 7, 12, 0.96)']}
            style={styles.overlayBottomGradient}
            pointerEvents="box-none"
          >
            {/* Linha Amarela/Laranja com "Ao vivo" */}
            <View style={styles.overlayLiveLineRow}>
              <View style={styles.overlayLiveLine} />
              <Text style={styles.overlayLiveLineText}>Ao vivo</Text>
            </View>

            {/* Pílulas Inferiores Centralizadas */}
            <View style={styles.overlayBottomRow}>
              <View style={styles.overlayPillsGroup}>
                <LivePillButton
                  icon="list"
                  label="Canais"
                  hasPreferredFocus={true}
                  onPress={() => {
                    onOpenDrawer?.();
                  }}
                />
                <LivePillButton
                  icon="calendar-outline"
                  label="Programação"
                  onPress={() => {
                    setShowEpgModal(true);
                  }}
                />
                <LivePillButton
                  icon={isFav ? 'star' : 'star-outline'}
                  iconColor={isFav ? '#FFA000' : '#FFFFFF'}
                  label={isFav ? 'Favoritado' : 'Favoritar'}
                  onPress={() => {
                    if (activeChannel) onToggleFavorite(activeChannel);
                    onResetOverlayTimer?.();
                  }}
                />
              </View>

              {/* Marca d'água da Emissora (Canto inferior direito) */}
              {activeChannel.stream_icon ? (
                <Image
                  source={{ uri: activeChannel.stream_icon }}
                  style={styles.overlayWatermarkLogo}
                  contentFit="contain"
                />
              ) : (
                <View style={styles.overlayWatermarkPlaceholder}>
                  <Ionicons name="tv-outline" size={26} color="rgba(255,255,255,0.3)" />
                </View>
              )}
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Modal de Programação Completa (EPG) */}
      <Modal
        visible={showEpgModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEpgModal(false)}
      >
        <View style={styles.epgModalBackdrop}>
          <View style={styles.epgModalCard}>
            <View style={styles.epgModalHeader}>
              <View style={styles.epgModalHeaderInfo}>
                <Ionicons name="calendar" size={24} color={colors.primaryAmber} style={{ marginRight: 10 }} />
                <View>
                  <Text style={styles.epgModalTitle}>Programação</Text>
                  <Text style={styles.epgModalSubtitle} numberOfLines={1}>
                    {activeChannel?.name || 'Canal'}
                  </Text>
                </View>
              </View>

              <Pressable
                focusable={true}
                hasTVPreferredFocus={true}
                onPress={() => setShowEpgModal(false)}
                style={({ focused }: any) => [
                  styles.epgCloseBtn,
                  focused && styles.focusedButton,
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons name="close" size={20} color={focused ? '#070A12' : '#FFF'} />
                )}
              </Pressable>
            </View>

            <FlatList
              data={epgList && epgList.length > 0 ? epgList : currentEpg ? [currentEpg] : []}
              keyExtractor={(item, idx) => `${item.id || idx}-${item.start || idx}`}
              contentContainerStyle={styles.epgModalListContent}
              renderItem={({ item, index }) => (
                <View style={[styles.epgModalItem, index === 0 && styles.epgModalItemCurrent]}>
                  <View style={styles.epgModalTimeCol}>
                    <Text style={styles.epgModalTimeText}>
                      {item.start ? `${item.start} - ${item.end}` : 'Ao vivo'}
                    </Text>
                    {index === 0 && (
                      <View style={styles.epgModalNowBadge}>
                        <Text style={styles.epgModalNowText}>NO AR</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.epgModalDetailsCol}>
                    <Text style={styles.epgModalItemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={styles.epgModalItemDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.epgEmptyBox}>
                  <Ionicons name="information-circle-outline" size={36} color="#8E8E93" />
                  <Text style={styles.epgEmptyTitle}>Programação não disponível</Text>
                  <Text style={styles.epgEmptySubtitle}>
                    O servidor IPTV não possui guia detalhado para este canal no momento.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

// Botão Pílula Inferior (Canais, Programação, Favoritar - Conforme fotos do usuário)
function LivePillButton({
  icon,
  iconColor,
  label,
  hasPreferredFocus,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  hasPreferredFocus?: boolean;
  onPress: () => void;
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
        styles.overlayPillBtn,
        isFocused && styles.overlayPillBtnFocused,
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={isFocused ? '#070A12' : iconColor || '#FFFFFF'}
        style={{ marginRight: 8 }}
      />
      <Text
        style={[
          styles.overlayPillBtnText,
          isFocused && styles.overlayPillBtnTextFocused,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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
        color={isFocused ? '#070A12' : isFavoriteTab ? '#FFA000' : isSelected ? colors.primary : '#8E8E93'}
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
  hasPreferredFocus,
  onPress,
  onFocusChannel,
  onToggleFavorite,
}: {
  num: number;
  channel: LiveChannel;
  isPlaying: boolean;
  isFavorite: boolean;
  hasPreferredFocus?: boolean;
  onPress: () => void;
  onFocusChannel?: (channel: LiveChannel) => void;
  onToggleFavorite: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasPreferredFocus}
      onFocus={() => {
        setIsFocused(true);
        onFocusChannel?.(channel);
      }}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      onLongPress={onToggleFavorite}
      style={[
        styles.channelItem,
        isPlaying && styles.channelItemPlaying,
        isFocused && styles.focusedItem,
      ]}
    >
      <Text style={[styles.channelNumText, isFocused && styles.focusedChannelNumText]}>
        {String(num).padStart(3, '0')}
      </Text>

      {channel.stream_icon ? (
        <Image
          source={{ uri: channel.stream_icon }}
          style={styles.channelItemLogo}
          contentFit="contain"
        />
      ) : (
        <View style={styles.channelItemLogoPlaceholder}>
          <Ionicons name="tv" size={13} color={isFocused ? '#070A12' : '#888'} />
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
        <View style={[styles.playingBadgePill, isFocused && { backgroundColor: '#070A12' }]}>
          <Ionicons name="volume-high" size={13} color={isFocused ? colors.primary : '#FFF'} />
        </View>
      )}

      {isFavorite && (
        <Ionicons name="star" size={14} color={isFocused ? '#070A12' : '#FFA000'} style={{ marginLeft: 6 }} />
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
  const isZapping = variant === 'zapping';
  return (
    <Pressable
      focusable={true}
      hasTVPreferredFocus={hasPreferredFocus}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        isZapping
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
    borderColor: '#FFFFFF',
    backgroundColor: colors.primary, // #00E5FF Axi Neon Cyan
    borderWidth: 2.5,
    transform: [{ scale: 1.06 }],
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
  },
  focusedItemText: {
    color: '#070A12',
    fontWeight: '900',
  },
  focusedChannelNumText: {
    color: '#070A12',
    fontWeight: '900',
  },
  focusedButton: {
    borderColor: '#FFFFFF',
    backgroundColor: colors.primary, // #00E5FF (Cores do sistema Axi)
    borderWidth: 2.5,
    transform: [{ scale: 1.10 }],
    elevation: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
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
  detailsActionsContainer: {
    marginVertical: 6,
    gap: 6,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1E2845',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2A365B',
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  zappingDpadHint: {
    textAlign: 'center',
    color: '#707076',
    fontSize: 11,
    marginTop: 8,
    letterSpacing: 0.3,
  },

  // Live Player Overlay (Fotos de Referência)
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    zIndex: 85,
  },
  overlayTopGradient: {
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 28,
  },
  overlayTopBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  channelInfoDarkCard: {
    backgroundColor: 'rgba(5, 7, 14, 0.94)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxWidth: '75%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 12,
  },
  channelInfoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  liveIndicatorText: {
    color: '#E52D27',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginLeft: 6,
  },
  overlayChannelName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  overlaySubtitle: {
    color: colors.primaryAmber, // #FFA000
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  overlayCenterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  overlayCenterSideBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(20, 24, 34, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCenterPlayPauseBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(20, 24, 34, 0.88)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 28,
  },
  overlayFocusedPlayPauseBtn: {
    backgroundColor: colors.primary, // #00E5FF
    borderColor: '#FFFFFF',
    borderWidth: 3.5,
    transform: [{ scale: 1.15 }],
    elevation: 18,
  },
  overlayBottomGradient: {
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 22,
  },
  overlayLiveLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  overlayLiveLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#FF9800',
    borderRadius: 2,
  },
  overlayLiveLineText: {
    color: '#FF9800',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  overlayBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  overlayPillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  overlayPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 34, 48, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  overlayPillBtnFocused: {
    backgroundColor: colors.primary, // #00E5FF
    borderColor: '#FFFFFF',
    borderWidth: 2.5,
    transform: [{ scale: 1.08 }],
    elevation: 10,
  },
  overlayPillBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  overlayPillBtnTextFocused: {
    color: '#070A12',
    fontWeight: '900',
  },
  overlayWatermarkLogo: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 54,
    height: 54,
    opacity: 0.85,
  },
  overlayWatermarkPlaceholder: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // EPG Modal Styles
  epgModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  epgModalCard: {
    width: '80%',
    maxHeight: '80%',
    backgroundColor: '#0E1322',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E2845',
    padding: 24,
  },
  epgModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2845',
    marginBottom: 16,
  },
  epgModalHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  epgModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  epgModalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  epgCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E2845',
    justifyContent: 'center',
    alignItems: 'center',
  },
  epgModalListContent: {
    gap: 12,
  },
  epgModalItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  epgModalItemCurrent: {
    borderColor: colors.primaryAmber,
    backgroundColor: 'rgba(255, 160, 0, 0.08)',
  },
  epgModalTimeCol: {
    width: 130,
  },
  epgModalTimeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  epgModalNowBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryAmber,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  epgModalNowText: {
    color: '#070A12',
    fontSize: 9,
    fontWeight: '900',
  },
  epgModalDetailsCol: {
    flex: 1,
    marginLeft: 12,
  },
  epgModalItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  epgModalItemDesc: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  epgEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  epgEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 10,
  },
  epgEmptySubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
  },
});
