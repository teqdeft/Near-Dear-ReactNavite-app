import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, AppButton, IconBadge } from './UI';
import { colors, spacing, font } from '../theme';

/**
 * Shown in place of a screen's form when the user hasn't completed Aadhaar KYC.
 * Blood donation / requests require a verified identity.
 */
export default function KycGate({ navigation, action = 'continue' }) {
  return (
    <Screen scroll>
      <View style={styles.wrap}>
        <IconBadge name="shield" color={colors.warning} size={72} iconSize={36} />
        <Text style={styles.title}>Verification required</Text>
        <Text style={styles.sub}>
          For everyone&apos;s safety, please complete your Aadhaar (KYC) verification before you can {action}.
        </Text>
        <AppButton title="Verify Aadhaar now" icon="shield"
          onPress={() => navigation.navigate('AadhaarVerify')}
          style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.md },
  title: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, marginTop: spacing.lg },
  sub: { fontSize: font.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
});
