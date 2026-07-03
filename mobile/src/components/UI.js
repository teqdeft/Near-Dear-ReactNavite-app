import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, shadow } from '../theme';
import Icon from './Icon';

export { Icon };

// ---- Screen wrapper ---------------------------------------------------
export function Screen({ children, scroll = false, style, padded = true, edges = ['top'] }) {
  const inner = (
    <View style={[padded && { padding: spacing.lg }, { flexGrow: 1 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

// ---- Text -------------------------------------------------------------
export function Title({ children, style }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}
export function Subtitle({ children, style }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}
export function SectionTitle({ children, right, style }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}
export function Muted({ children, style }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

// ---- Button -----------------------------------------------------------
export function AppButton({
  title, onPress, loading, disabled, variant = 'primary', color, style, icon, size = 'md',
}) {
  const accent = color || colors.primary;
  const filled = variant === 'primary';
  const bg = filled ? accent : 'transparent';
  const borderColor = variant === 'outline' ? accent : 'transparent';
  const textColor = filled ? colors.white : accent;
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.btn,
        size === 'sm' && styles.btnSm,
        { backgroundColor: bg, borderColor, borderWidth: variant === 'outline' ? 1.5 : 0 },
        filled && shadow.soft,
        isDisabled && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Icon name={icon} size={18} color={textColor} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.btnText, size === 'sm' && { fontSize: font.small }, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---- Input ------------------------------------------------------------
export function TextField({ label, error, leftIcon, style, inputStyle, secureTextEntry, ...props }) {
  const [hidden, setHidden] = React.useState(true);
  const isPassword = !!secureTextEntry;
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, error && { borderColor: colors.danger }]}>
        {leftIcon ? <Icon name={leftIcon} size={19} color={colors.textMuted} style={{ marginRight: 8 }} /> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, inputStyle]}
          secureTextEntry={isPassword ? hidden : false}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={20} color={colors.textMuted} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ---- Card -------------------------------------------------------------
export function Card({ children, style, onPress }) {
  const Comp = onPress ? TouchableOpacity : View;
  return (
    <Comp activeOpacity={0.9} onPress={onPress} style={[styles.card, shadow.card, style]}>
      {children}
    </Comp>
  );
}

// ---- IconBadge (rounded tinted icon container) ------------------------
export function IconBadge({ name, color = colors.primary, tint, size = 48, iconSize = 24, style }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: radius.md, backgroundColor: tint || color + '18', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={name} size={iconSize} color={color} />
    </View>
  );
}

// ---- Avatar -----------------------------------------------------------
export function Avatar({ name, size = 48, color = colors.primary }) {
  const initials = (name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.white, fontWeight: font.bold, fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

// ---- ListRow (icon • title/subtitle • chevron) ------------------------
export function ListRow({ icon, iconColor = colors.primary, title, subtitle, right, onPress, danger, last }) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.listRow, !last && styles.listRowBorder]}>
      {icon ? <IconBadge name={icon} color={danger ? colors.danger : iconColor} size={38} iconSize={20} style={{ marginRight: spacing.md }} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.listTitle, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.listSub}>{subtitle}</Text> : null}
      </View>
      {right !== undefined ? right : <Icon name="next" size={22} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

// ---- Pill / Badge -----------------------------------------------------
export function Pill({ label, color = colors.primary, bg, style, icon }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg || color + '1E' }, style]}>
      {icon ? <Icon name={icon} size={12} color={color} style={{ marginRight: 4 }} /> : null}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress, color = colors.primary }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, active ? { backgroundColor: color, borderColor: color } : { borderColor: colors.border }]}>
      <Text style={[styles.chipText, { color: active ? colors.white : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---- Loader / Empty ---------------------------------------------------
export function Loader({ text }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {text ? <Text style={styles.muted}>{text}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = 'information-outline', title, subtitle, action }) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}><Icon name={icon} size={38} color={colors.primary} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={[styles.muted, { textAlign: 'center', marginTop: 4 }]}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

// ---- Misc -------------------------------------------------------------
export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}
export function Spacer({ h = spacing.md }) {
  return <View style={{ height: h }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  muted: { color: colors.textMuted, fontSize: font.small },

  btn: { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  btnSm: { height: 40, borderRadius: radius.sm, paddingHorizontal: spacing.md },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnText: { fontSize: font.body, fontWeight: font.semibold },

  label: { fontSize: font.small, color: colors.text, marginBottom: 7, fontWeight: font.semibold },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52,
  },
  input: { flex: 1, fontSize: font.body, color: colors.text, ...(Platform.OS === 'android' ? { paddingVertical: 8 } : {}) },
  errorText: { color: colors.danger, fontSize: font.tiny, marginTop: 4 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  listTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  listSub: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },

  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: font.tiny, fontWeight: font.bold, textTransform: 'capitalize' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1.5, marginRight: spacing.sm, marginBottom: spacing.sm },
  chipText: { fontSize: font.small, fontWeight: font.semibold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
});

export default {
  Screen, Title, Subtitle, SectionTitle, Muted, AppButton, TextField, Card,
  IconBadge, Avatar, ListRow, Pill, Chip, Loader, EmptyState, Row, Spacer, Icon,
};
