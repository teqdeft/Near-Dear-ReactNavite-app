/**
 * NearDear design system — colors, spacing, typography, shadows.
 * One source of truth so every screen feels consistent.
 */

export const colors = {
  // Brand
  primary: '#0E9F8E', // healthcare teal
  primaryDark: '#0B7D70',
  primaryLight: '#E6F7F4',

  // Module accents
  blood: '#E63946',
  bloodLight: '#FDE8EA',
  ambulance: '#2B6CB0',
  ambulanceLight: '#E4EEF8',
  pharmacy: '#2F9E44',
  pharmacyLight: '#E6F6EA',

  // Status
  success: '#2F9E44',
  warning: '#E8A317',
  danger: '#E03131',
  info: '#2B6CB0',

  // Neutrals
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  text: '#1A2027',
  textMuted: '#67727E',
  border: '#E6E9EE',
  overlay: 'rgba(16, 24, 32, 0.45)',

  white: '#FFFFFF',
  black: '#000000',
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const font = {
  // sizes
  h1: 26,
  h2: 22,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,
  // weights
  bold: '700',
  semibold: '600',
  medium: '500',
  regular: '400',
};

export const shadow = {
  card: {
    shadowColor: '#0B1E2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  soft: {
    shadowColor: '#0B1E2D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
};

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default { colors, spacing, radius, font, shadow, BLOOD_GROUPS };
