/**
 * "Village" art direction: cozy, warm and rounded (inspired by life-sim games).
 * Cream background, wood-brown text, lagoon-blue accent, pastel tints.
 * Every color / font goes through this file: screens never hard-code one.
 */
export const colors = {
  background: '#F6EFD9', // cream
  surface: '#FFFBEE', // cards, fields
  text: '#5E4532', // wood brown
  textMuted: '#A38A70',
  /** Bottom "thickness" of cards and buttons (pressable 3D look) */
  edge: '#E6D9B6',
  line: '#EADFC4',
  primary: '#2E4A5E', // lagoon
  primaryDark: '#1D3242',
  onPrimary: '#FFFBEE',
  /** Light layer of Phosphor duotone icons */
  duo: '#C9E1EE',
  /** Highlight behind the active tab */
  tabActive: '#DCEBF3',
  disabled: '#CFC3A8',
  backdrop: 'rgba(60, 42, 28, 0.45)',
  /** Camera overlay (barcode scanner) */
  overlay: '#FFFFFF',
};

/** Pastel backgrounds behind illustrations (rooms, furniture, items). */
export const tints = ['#FFDCC2', '#D4ECF7', '#FFEFA6', '#D2EFC9', '#E8DDF6', '#FAD6DA'] as const;

/** Picks a stable pastel for a name (same name → same color). */
export function tintFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return tints[Math.abs(h) % tints.length];
}

/** Status badges */
export const tones = {
  expired: { bg: '#FAD0CC', fg: '#A63A30' },
  soon: { bg: '#FFE2C4', fg: '#B0601C' },
  low: { bg: '#FFF0A8', fg: '#7A620B' },
  out: { bg: '#E8E0CF', fg: '#7D6B57' },
  frozen: { bg: '#D4ECF7', fg: '#2E5F7A' },
  neutral: { bg: '#EFE6CF', fg: '#5E4532' },
} as const;
export type Tone = keyof typeof tones;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

/**
 * Fredoka, loaded in the root layout. Android does not derive weights from a
 * custom family: each weight is its own family, never use `fontWeight` with them.
 */
export const fonts = {
  regular: 'Fredoka_400Regular',
  medium: 'Fredoka_500Medium',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
};

export const font = {
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  heading: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
};

/** Soft card: surface + a thicker bottom edge. */
export const card = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderBottomWidth: 3,
  borderBottomColor: colors.edge,
};
