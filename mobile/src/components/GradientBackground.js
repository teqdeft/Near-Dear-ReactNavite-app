import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

/**
 * Soft "gradient" backdrop built with pure RN (no native gradient module):
 * a light base with two blurred-looking tinted blobs (green top-left, pink top-right).
 * Looks close to a diagonal pastel gradient and needs zero native code.
 */
export default function GradientBackground({ children, style }) {
  return (
    <View style={[styles.fill, style]}>
      <View pointerEvents="none" style={styles.blobGreen} />
      <View pointerEvents="none" style={styles.blobPink} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  blobGreen: { position: 'absolute', top: -90, left: -70, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(22,163,74,0.12)' },
  blobPink: { position: 'absolute', top: -60, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(239,68,68,0.09)' },
});
