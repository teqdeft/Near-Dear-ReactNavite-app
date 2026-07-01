import React from 'react';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../theme';

/**
 * Thin wrapper over MaterialCommunityIcons with a set of semantic aliases,
 * so screens can say <Icon name="blood" /> instead of remembering glyph names.
 */
const ALIASES = {
  // navigation / tabs
  home: 'home-variant',
  orders: 'clipboard-list-outline',
  bell: 'bell-outline',
  profile: 'account-circle-outline',
  trips: 'map-marker-path',
  dashboard: 'view-dashboard-outline',

  // modules
  blood: 'water',
  ambulance: 'ambulance',
  pharmacy: 'pill',
  medicine: 'pill',
  cart: 'cart-outline',
  hospital: 'hospital-building',
  support: 'lifebuoy',
  donor: 'heart-plus-outline',
  request: 'hand-heart-outline',
  prescription: 'file-document-outline',

  // ui
  back: 'chevron-left',
  next: 'chevron-right',
  arrow: 'arrow-right',
  arrowUpRight: 'arrow-top-right',
  search: 'magnify',
  phone: 'phone',
  location: 'map-marker-outline',
  shield: 'shield-check-outline',
  check: 'check-circle',
  close: 'close',
  plus: 'plus',
  minus: 'minus',
  edit: 'pencil-outline',
  logout: 'logout',
  trash: 'trash-can-outline',
  camera: 'camera-outline',
  upload: 'tray-arrow-up',
  clock: 'clock-outline',
  email: 'email-outline',
  lock: 'lock-outline',
  user: 'account-outline',
  calendar: 'calendar-outline',
  alert: 'alert-circle-outline',
  info: 'information-outline',
  star: 'star',
  chevronRight: 'chevron-right',
  bloodBag: 'blood-bag',
  truck: 'truck-fast-outline',
  pin: 'map-marker',
  online: 'circle',
};

export default function Icon({ name, size = 22, color = colors.text, style }) {
  const glyph = ALIASES[name] || name;
  return <MCI name={glyph} size={size} color={color} style={style} />;
}
