import { StyleSheet } from 'react-native';

/**
 * Axi Player TV - Sistema de Design e Estilo Unificado Oficial
 * Cores do Sistema: Axi Neon Cyan (#00E5FF), Axi Neon Purple (#A855F7), Dark OLED (#070A12)
 */

export const tvColors = {
  // Backgrounds (Dark OLED)
  background: '#070A12',
  surface: '#0E1322',
  surfaceLight: '#151C30',
  surfaceHighlight: '#1E2845',
  card: '#101628',
  cardHover: '#182038',
  overlayDark: 'rgba(7, 10, 18, 0.96)',
  overlayBackdrop: 'rgba(7, 10, 18, 0.85)',

  // Marca Axi Neon - Cores Primárias do Sistema
  primary: '#00E5FF',       // Axi Neon Cyan (Ação Principal, Foco, Botões Primários)
  secondary: '#A855F7',     // Axi Neon Purple (Badges de Destaque, Acentos Secundários)
  neonCyan: '#00E5FF',
  neonPurple: '#A855F7',
  neonMagenta: '#D946EF',

  // Foco & Seleção do Sistema Axi (Neon Cyan)
  focusRing: '#00E5FF',
  focusRingSecondary: '#A855F7',
  focusBackground: 'rgba(0, 229, 255, 0.20)',
  focusSurface: '#1E2845',

  // Ações Primárias do Sistema ("Assistir", "Guia", "Temporadas", "Padrão")
  buttonPrimary: '#00E5FF',
  buttonPrimaryText: '#070A12',
  buttonSecondary: '#151C30',
  buttonSecondaryBorder: '#1E2845',

  // Hierarquia de Texto
  text: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  textInverse: '#070A12',

  // Bordas e Divisores
  border: '#1E2845',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  borderHighlight: '#00E5FF',

  // Badges & Status do Sistema
  badgeDestaque: '#A855F7', // Neon Purple oficial da marca
  badgeLive: '#FF1744',
  badge4KBackground: 'rgba(255, 255, 255, 0.15)',
  badge4KBorder: 'rgba(255, 255, 255, 0.25)',
  ratingStar: '#FFD700', // Apenas para estrela de avaliação
  success: '#00E676',
  warning: '#FFB300',
  error: '#FF3B30',
  info: '#00E5FF',
};

export const tvTypography = {
  heroTitle: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: tvColors.textPrimary,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: tvColors.textPrimary,
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: tvColors.textPrimary,
  },
  body: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: tvColors.textSecondary,
    lineHeight: 19,
  },
  synopsis: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: tvColors.textSecondary,
    lineHeight: 19,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: tvColors.textPrimary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '900' as const,
  },
};

export const tvSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  hero: 32,
};

export const tvRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
};

/**
 * Estilos oficiais unificados para todos os botões e componentes do sistema.
 */
export const tvStyles = StyleSheet.create({
  // Container de Tela Dark OLED
  screenContainer: {
    flex: 1,
    backgroundColor: tvColors.background,
  },

  // Barra Superior (Top Bar)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: tvColors.overlayDark,
    zIndex: 20,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: tvColors.border,
  },

  // Botão Primário "Assistir" / "Continuar" nas telas de Filmes e Séries (Azulado Oficial: #00E5FF)
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tvColors.primary, // #00E5FF (Azulado / Cyan Oficial da Axi)
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: tvRadius.md,
    borderWidth: 2,
    borderColor: tvColors.primary,
  },
  watchButtonFocused: {
    borderColor: '#FFFFFF', // Borda branca em foco para alto contraste
    backgroundColor: tvColors.primary,
    transform: [{ scale: 1.08 }],
    elevation: 14,
    shadowColor: tvColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  watchButtonText: {
    color: '#070A12', // Escuro para contraste sobre o fundo azulado
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 6,
  },

  // Botão Específico "Continuar Assistindo" do Modal de Confirmação de Saída do Player (Branco Sólido)
  dialogBtnContinueWhite: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  dialogBtnContinueWhiteFocused: {
    borderColor: tvColors.primary,
    backgroundColor: '#FFFFFF',
    transform: [{ scale: 1.06 }],
  },
  dialogBtnContinueWhiteText: {
    color: '#000000',
    fontWeight: '900',
  },

  // Botão Secundário de Ação (Minha lista, Assistir depois, Favoritar)
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tvColors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tvRadius.md,
    borderWidth: 1.5,
    borderColor: tvColors.border,
  },
  actionIconBtnFocused: {
    borderColor: tvColors.primary,
    backgroundColor: tvColors.focusBackground,
    transform: [{ scale: 1.06 }],
  },
  actionBtnText: {
    color: tvColors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },

  // Botão de Trailer
  trailerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 28, 48, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tvRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 0, 0, 0.4)',
  },
  trailerButtonText: {
    color: tvColors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },

  // Badge 4K UHD
  badge4K: {
    backgroundColor: tvColors.badge4KBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tvRadius.xs,
    borderWidth: 1,
    borderColor: tvColors.badge4KBorder,
  },
  badge4KText: {
    color: tvColors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },

  // Badge DESTAQUE (Axi Purple)
  badgeDestaque: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: tvColors.secondary, // #A855F7
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: tvRadius.xs,
    zIndex: 10,
  },
  badgeDestaqueText: {
    color: tvColors.textPrimary,
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // Rating Box (⭐ 8.2 | 2025)
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    gap: 6,
  },
  ratingNumber: {
    color: tvColors.primary,
    fontWeight: '900',
    fontSize: 15,
  },
  ratingDivider: {
    color: tvColors.textSubtle,
    fontWeight: '600',
  },
  ratingYear: {
    color: tvColors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },

  // Tag / Chip de Gênero
  genreChip: {
    backgroundColor: 'rgba(21, 28, 48, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: tvRadius.sm,
    borderWidth: 1,
    borderColor: tvColors.border,
  },
  genreChipText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '600',
  },
});
