import { tvColors } from './tvTheme';

export const colors = {
  ...tvColors,
  // Backward compatibility aliases
  primaryAmber: tvColors.neonPurple,
  primaryCrimson: tvColors.neonMagenta,
  brandDarkBg: tvColors.background,
  textMuted: '#94A3B8',
  borderHighlight: tvColors.primary,
  focusRing: tvColors.primary, // #00E5FF
  focusYellow: tvColors.primary,
  accentYellow: tvColors.primary,
};
