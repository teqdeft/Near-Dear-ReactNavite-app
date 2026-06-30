import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, shadow } from '../theme';

// ---- Screen wrapper ---------------------------------------------------
export function Screen({ children, scroll = false, style, padded = true, edges = ['top'] }) {
  const inner = (
    <View style={[padded && { padding: spacing.lg }, { flexGrow: 1 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
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

// ---- Button -----------------------------------------------------------
export function AppButton({
  title, onPress, loading, disabled, variant = 'primary', color, style, icon,
}) {
  const bg = variant === 'outline' || variant === 'ghost' ? 'transparent' : color || colors.primary;
  const borderColor = variant === 'outline' ? color || colors.primary : 'transparent';
  const textColor =
    variant === 'outline' || variant === 'ghost' ? color || colors.primary : colors.white;
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor, borderWidth: variant === 'outline' ? 1.5 : 0 },
        isDisabled && { opacity: 0.5 },
        variant === 'primary' && shadow.soft,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.btnText, { color: textColor }]}>
          {icon ? `${icon}  ` : ''}{title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ---- Input ------------------------------------------------------------
export function TextField({ label, error, style, ...props }) {
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error && { borderColor: colors.danger }]}
        {...props}
      />
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

// ---- Pill / Chip ------------------------------------------------------
export function Pill({ label, color = colors.primary, bg, style }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg || color + '22' }, style]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress, color = colors.primary }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        active ? { backgroundColor: color, borderColor: color } : { borderColor: colors.border },
      ]}>
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

export function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 48, marginBottom: spacing.sm }}>{icon}</Text>
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
export function Muted({ children, style }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  btn: {
    height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnText: { fontSize: font.body, fontWeight: font.semibold },
  label: { fontSize: font.small, color: colors.textMuted, marginBottom: 6, fontWeight: font.medium },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    height: 50, fontSize: font.body, color: colors.text,
    ...(Platform.OS === 'android' ? { paddingVertical: 8 } : {}),
  },
  errorText: { color: colors.danger, fontSize: font.tiny, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: font.tiny, fontWeight: font.bold, textTransform: 'capitalize' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: 1.5, marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  chipText: { fontSize: font.small, fontWeight: font.medium },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: font.small, marginTop: spacing.sm },
  emptyTitle: { fontSize: font.h3, fontWeight: font.semibold, color: colors.text },
});

export default {
  Screen, Title, Subtitle, SectionTitle, AppButton, TextField, Card, Pill, Chip,
  Loader, EmptyState, Row, Spacer, Muted,
};
