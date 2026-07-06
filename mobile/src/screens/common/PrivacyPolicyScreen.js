import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Muted } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

// NOTE: Placeholder content — replace with the finalised legal text before launch.
const SECTIONS = [
  {
    title: '1. Introduction',
    body: 'NearDear ("we", "our", "us") is a healthcare platform that connects users with blood donors, ambulance services and pharmacies. This Privacy Policy explains how we collect, use and protect your information. This is placeholder text and will be replaced with our finalised policy before public launch.',
  },
  {
    title: '2. Information We Collect',
    body: 'We collect the information you provide when you create an account and use the app — your name, mobile number, email, city and address, blood group, and details you submit for blood requests, ambulance bookings, medicine orders and prescriptions.',
  },
  {
    title: '3. Aadhaar / KYC Data',
    body: 'For safety, certain actions require identity verification. We only store the last 4 digits of your Aadhaar and a verification reference — we never store your full Aadhaar number. KYC is used solely to verify identity for blood donation and ambulance services.',
  },
  {
    title: '4. How We Use Your Information',
    body: 'Your information is used to operate the service — matching donors with requests, dispatching ambulances, fulfilling medicine orders, and notifying you about activity relevant to you. We do not sell your personal data.',
  },
  {
    title: '5. Sharing of Information',
    body: 'Contact details are shared only when necessary to complete a service — for example, a donor’s number is shared with a requester only after the donor accepts, and a pharmacy sees a customer’s delivery details only for their order.',
  },
  {
    title: '6. Data Security',
    body: 'We use reasonable technical and organisational measures to protect your data. Uploaded documents (such as prescriptions and vehicle papers) are stored privately and served only to authorised users.',
  },
  {
    title: '7. Your Rights',
    body: 'You can view and update your profile, and request deletion of your account and data from within the app. Placeholder text — the finalised policy will detail your rights and how to exercise them.',
  },
  {
    title: '8. Contact Us',
    body: 'For any privacy questions, contact us through the in-app Support section. This contact information is a placeholder and will be updated.',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <Screen scroll edges={[]}>
      <Text style={styles.title}>Privacy Policy & Consent</Text>
      <View style={styles.notice}>
        <Muted style={{ color: colors.warning, fontWeight: font.medium }}>
          ⚠️ Placeholder document — the final Privacy Policy will be published before launch.
        </Muted>
      </View>
      <Muted style={{ marginBottom: spacing.lg }}>Last updated: to be finalised</Muted>

      {SECTIONS.map((s) => (
        <View key={s.title} style={{ marginBottom: spacing.lg }}>
          <Text style={styles.heading}>{s.title}</Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}

      <View style={styles.consentBox}>
        <Text style={styles.body}>
          By creating an account and using NearDear, you acknowledge that you have read and agree to this
          Privacy Policy and consent to the collection and use of your information as described above.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  notice: { backgroundColor: '#FFF7E6', borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
  heading: { fontSize: font.body, fontWeight: font.bold, color: colors.text, marginBottom: 4 },
  body: { fontSize: font.body, color: colors.textMuted, lineHeight: 22 },
  consentBox: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.border },
});
