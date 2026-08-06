export const COLORS = {
  primary: '#059669', // Emerald 600 (Sesuai dengan SmartBarn Web)
  primaryDark: '#047857',
  secondary: '#10b981',
  background: '#f8fafc',
  white: '#ffffff',
  text: '#0f172a',        // Slate 900 (High Contrast Title)
  textSecondary: '#475569', // Slate 600 (Medium Contrast Body)
  textLight: '#64748b',     // Slate 500 (Subtitles/Labels)
  textMuted: '#94a3b8',     // Slate 400 (Captions/Metadata)
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  card: '#ffffff',
  border: '#e2e8f0',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// --- TYPOGRAPHY SCALE SYSTEM & VISUAL HIERARCHY ---
export const FONT_SIZE = {
  micro: 10,
  caption: 11,
  sm: 12,
  body: 13,
  md: 14,
  h3: 15,
  h2: 16,
  h1: 20,
  display: 24,
};

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const TYPOGRAPHY = {
  display: {
    fontSize: FONT_SIZE.display,
    fontWeight: FONT_WEIGHT.heavy,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: COLORS.text,
  },
  h1: {
    fontSize: FONT_SIZE.h1,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: COLORS.text,
  },
  h2: {
    fontSize: FONT_SIZE.h2,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 22,
    color: COLORS.text,
  },
  h3: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: 20,
    color: COLORS.text,
  },
  body: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.regular,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  bodyBold: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: 18,
    color: COLORS.text,
  },
  caption: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: 15,
    color: COLORS.textLight,
  },
  micro: {
    fontSize: FONT_SIZE.micro,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 13,
    color: COLORS.textMuted,
  },
};

export const SHADOWS = {
  sm: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
};
