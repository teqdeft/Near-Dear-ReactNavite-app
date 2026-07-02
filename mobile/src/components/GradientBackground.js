import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Smooth gradient rendered from a bundled PNG — no native gradient module,
// so it works everywhere with a simple reload.
const BG = require('../assets/bg-gradient.png');

export default function GradientBackground({ children, style }) {
  return (
    <ImageBackground source={BG} resizeMode="cover" style={[styles.fill, style]}>
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
});
