import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, AppButton, IconBadge } from './UI';
import { useAuth } from '../store/AuthContext';
import { colors, spacing, font } from '../theme';

/**
 * Shown in place of a screen's form when the user hasn't completed Aadhaar KYC.
 * Blood donation / requests / driver actions require a verified identity.
 * KYC is done manually (upload Aadhaar photos -> admin approval), so this sends
 * the user to the AadhaarUpload flow. While a submission is under review we show
 * a "pending" message instead of asking them to submit again.
 */
export default function KycGate({ navigation, action = 'continue', accent = colors.primary }) {
  const { user } = useAuth();
  const pending = user?.aadhaar_kyc_status === 'pending';

  return (
    <Screen scroll>
      <View style={styles.wrap}>
        <IconBadge name={pending ? 'clock' : 'shield'} color={colors.warning} size={72} iconSize={36} />
        <Text style={styles.title}>{pending ? 'Verification under review' : 'Verification required'}</Text>
        <Text style={styles.sub}>
          {pending
            ? `Your Aadhaar is being verified by our team. You'll be able to ${action} once it's approved.`
            : `For everyone's safety, please complete your Aadhaar (KYC) verification before you can ${action}.`}
        </Text>
        <AppButton
          title={pending ? 'View verification status' : 'Verify Aadhaar now'}
          icon={pending ? 'clock' : 'shield'}
          color={accent}
          onPress={() => navigation.navigate('AadhaarUpload')}
          style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.md },
  title: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, marginTop: spacing.lg },
  sub: { fontSize: font.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
});
