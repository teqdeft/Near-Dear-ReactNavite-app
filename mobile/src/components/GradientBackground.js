import React from 'react';
import { StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { gradients } from '../theme';

export default function GradientBackground({ children, colors = gradients.bg, style }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, style]}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
