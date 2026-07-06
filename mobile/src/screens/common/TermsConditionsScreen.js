import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Muted } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

// NOTE: Placeholder content — replace with the finalised legal text before launch.
const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By downloading, accessing or using the NearDear app, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the app. This is placeholder text and will be replaced with our finalised terms before public launch.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 18 years old and capable of entering into a binding agreement to use NearDear. Certain services require identity (KYC) verification.',
  },
  {
    title: '3. Nature of Our Service',
    body: 'NearDear is a technology platform that connects users with blood donors, ambulance drivers and pharmacies. We are NOT a hospital, medical provider, ambulance operator or pharmacy, and we do not provide medical advice, treatment or emergency services ourselves.',
  },
  {
    title: '4. Medical & Emergency Disclaimer',
    body: 'NearDear does not guarantee the availability, timing or outcome of any blood donation, ambulance ride or medicine order. In a life-threatening emergency, always contact official emergency services. Always consult a qualified doctor for medical advice; prescription medicines require a valid prescription.',
  },
  {
    title: '5. User Responsibilities',
    body: 'You agree to provide accurate information, use the app lawfully, and not misuse it (for example, fake requests, spam, or impersonation). You are responsible for the activity on your account.',
  },
  {
    title: '6. Payments',
    body: 'Charges for medicine orders and any applicable service fees will be shown before you confirm. Placeholder text — pricing, refunds and cancellation terms will be detailed in the finalised policy.',
  },
  {
    title: '7. Limitation of Liability',
    body: 'To the maximum extent permitted by law, NearDear is not liable for any loss or harm arising from the acts of donors, drivers, pharmacies or other users, or from reliance on the service. Placeholder text.',
  },
  {
    title: '8. Suspension & Termination',
    body: 'We may suspend or terminate accounts that violate these terms or misuse the platform, to protect the safety and integrity of the service.',
  },
  {
    title: '9. Changes to These Terms',
    body: 'We may update these Terms from time to time. Continued use of the app after changes means you accept the updated Terms.',
  },
  {
    title: '10. Contact Us',
    body: 'For any questions about these Terms, contact us through the in-app Support section. This contact information is a placeholder and will be updated.',
  },
];

export default function TermsConditionsScreen() {
  return (
    <Screen scroll edges={[]}>
      <Text style={styles.title}>Terms & Conditions</Text>
      <View style={styles.notice}>
        <Muted style={{ color: colors.warning, fontWeight: font.medium }}>
          ⚠️ Placeholder document — the final Terms & Conditions will be published before launch.
        </Muted>
      </View>
      <Muted style={{ marginBottom: spacing.lg }}>Last updated: to be finalised</Muted>

      {SECTIONS.map((s) => (
        <View key={s.title} style={{ marginBottom: spacing.lg }}>
          <Text style={styles.heading}>{s.title}</Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  notice: { backgroundColor: '#FFF7E6', borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
  heading: { fontSize: font.body, fontWeight: font.bold, color: colors.text, marginBottom: 4 },
  body: { fontSize: font.body, color: colors.textMuted, lineHeight: 22 },
});
