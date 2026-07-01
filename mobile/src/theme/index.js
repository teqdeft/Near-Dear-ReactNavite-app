/**
 * NearDear design system — a clean, modern token set.
 * Palette leans on soft neutrals with a violet-indigo brand and
 * distinct, vivid module accents.
 */

export const colors = {
  // Brand — fresh emerald green
  primary: '#16A34A',
  primaryDark: '#12833C',
  primaryLight: '#E7F6EE',
  accent: '#10B981',

  // Module accents
  blood: '#EF4444',
  bloodLight: '#FDECEC',
  ambulance: '#2563EB',
  ambulanceLight: '#E7EFFE',
  pharmacy: '#16A34A',
  pharmacyLight: '#E7F6EE',
  orange: '#F59E0B',
  orangeLight: '#FEF1DE',

  // Status
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#2563EB',

  // Neutrals
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F9',
  text: '#0B1220',
  textMuted: '#6B7280',
  border: '#ECEFF3',
  overlay: 'rgba(15, 23, 42, 0.5)',

  white: '#FFFFFF',
  black: '#000000',
  dark: '#111827',
};

// Gradients (used with react-native-linear-gradient)
export const gradients = {
  bg: ['#E9F7EF', '#F5F7FA', '#FCEEF0'],
  emergency: ['#FF5A6A', '#E11D48'],
  primary: ['#22C55E', '#16A34A'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const font = {
  h1: 28,
  h2: 22,
  h3: 17,
  body: 15,
  small: 13,
  tiny: 11,
  bold: '700',
  semibold: '600',
  medium: '500',
  regular: '400',
};

export const shadow = {
  card: {
    shadowColor: '#5B54E8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  soft: {
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  none: {},
};

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default { colors, spacing, radius, font, shadow, gradients, BLOOD_GROUPS };
