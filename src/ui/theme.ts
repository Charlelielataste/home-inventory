/**
 * "Village" art direction: cozy, warm and rounded (inspired by life-sim games).
 * Cream background, wood-brown text, lagoon-blue accent, pastel tints.
 * Every color / font goes through this file: screens never hard-code one.
 */
export const colors = {
  background: '#F8F2DF', // light cream
  surface: '#FFFBEE', // cards, fields
  text: '#463020', // wood brown
  textMuted: '#836A51',
  /** Bottom "thickness" of cards and buttons (pressable 3D look) */
  edge: '#E6D9B6',
  /** Soft diffuse shadow under raised elements */
  shadow: 'rgba(94, 69, 50, 0.10)',
  line: '#EADFC4',
  /** Panel grouping cards on the background (rooms on the home screen) */
  panel: '#F5EED7',
  primary: '#2E4A5E', // lagoon
  primaryDark: '#1D3242',
  onPrimary: '#FFFBEE',
  /** Light layer of Phosphor duotone icons */
  duo: '#C9E1EE',
  /** Highlight behind the active tab */
  tabActive: '#DCEBF3',
  /** Destructive action (delete several items) */
  danger: '#C4513C',
  dangerDark: '#9A3B2A',
  /** Selected list row (selection mode) */
  selected: '#DCEBF3',
  selectedEdge: '#B9D5E4',
  /** Count bubble on tabs (alerts) */
  badge: '#D9604A', // terracotta
  /** Warm action that is not a deletion (« Épuisé » on item cards): terracotta */
  warn: '#B9653F',
  warnDark: '#8E4B2C',
  onBadge: '#FFFBEE',
  disabled: '#CFC3A8',
  backdrop: 'rgba(60, 42, 28, 0.45)',
  /** Camera overlay (barcode scanner) */
  overlay: '#FFFFFF',
  /** Behind the camera image, before it shows (barcode scanner): dark wood */
  camera: '#463020',
};

/** Pastel backgrounds behind illustrations (rooms, furniture, items). */
const tints = ['#FFDCC2', '#D4ECF7', '#FFEFA6', '#D2EFC9', '#E8DDF6', '#FAD6DA'] as const;

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
  neutral: { bg: '#EFE6CF', fg: '#463020' },
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
  /** Value between − / + (quantities, delays) */
  number: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  /** Big value between − / + (item form, modals) */
  numberLarge: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
};

/**
 * "Thickness" under pressable elements: a solid offset shadow + a soft diffuse one.
 * A shadow follows the rounded shape with an even thickness (a bottom border tapers
 * into a crescent on rounded corners).
 */
export function depth(height: number, color: string) {
  return {
    boxShadow: [
      { offsetX: 0, offsetY: height, blurRadius: 0, color },
      { offsetX: 0, offsetY: height + 2, blurRadius: 6, color: colors.shadow },
    ],
  };
}

/** Pressed state of raised elements: they sink into their thickness. */
export function sunk(height: number, color: string) {
  return { transform: [{ translateY: height - 1 }], ...depth(1, color) };
}

/** Soft card: surface + a thin bottom thickness. */
export const card = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  ...depth(3, colors.edge),
};
