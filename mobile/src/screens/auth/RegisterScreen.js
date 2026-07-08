import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { AuthApi } from '../../api';
import { errMessage } from '../../api/client';
import { Screen, AppButton, TextField, IconBadge } from '../../components/UI';
import Icon from '../../components/Icon';
import { colors, spacing, font, radius } from '../../theme';

const ROLES = [
  { key: 'user', icon: 'account', color: colors.primary, tint: colors.primaryLight, title: 'Normal User', sub: 'Request blood, ambulance & medicines — and donate blood' },
  { key: 'ambulance_driver', icon: 'ambulance', color: colors.ambulance, tint: colors.ambulanceLight, title: 'Ambulance Driver', sub: 'Receive nearby ambulance requests and accept trips' },
];

// Live, per-field validation — recomputed on every keystroke so an error
// appears/disappears as the user types, instead of only on submit.
function validateField(key, form) {
  switch (key) {
    case 'name':
      return form.name.trim() ? '' : 'Please enter your full name.';
    case 'mobile':
      return form.mobile.replace(/\D/g, '').length === 10 ? '' : 'Enter a valid 10-digit mobile number.';
    case 'email':
      return /^\S+@\S+\.\S+$/.test(form.email.trim()) ? '' : 'Enter a valid email address.';
    case 'password':
      return form.password.length >= 6 ? '' : 'Password must be at least 6 characters.';
    default:
      return '';
  }
}

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '' });
  const [role, setRole] = useState('user');
  const [channel, setChannel] = useState('sms'); // 'sms' | 'email' — where to send the OTP
  const [loading, setLoading] = useState(false);
  // A field only starts showing its error once the user has typed in it — so
  // the form doesn't open already covered in red.
  const [touched, setTouched] = useState({});
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  };
  const errorFor = (k) => (touched[k] ? validateField(k, form) : '');

  // Accent follows the selected role (user = teal, ambulance driver = blue).
  const selectedRole = ROLES.find((r) => r.key === role) || ROLES[0];
  const accent = selectedRole.color;
  const accentTint = selectedRole.tint;

  const onContinue = async () => {
    const fields = ['name', 'mobile', 'email', 'password'];
    const hasError = fields.some((k) => validateField(k, form));
    if (hasError) {
      // Reveal every field's error (in case some were never touched) instead
      // of silently doing nothing.
      setTouched({ name: true, mobile: true, email: true, password: true });
      return;
    }
    const mobile = form.mobile.replace(/\D/g, '');
    const email = form.email.trim().toLowerCase();
    setLoading(true);
    try {
      const res = await AuthApi.requestOtp({ mobile, email, channel });
      navigation.navigate('Otp', {
        mode: 'register', devCode: res?.data?.devCode, channel,
        payload: { name: form.name.trim(), mobile, email, password: form.password, role, channel },
      });
    } catch (e) {
      Alert.alert('Could not send OTP', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Choose how you want to use NearDear</Text>

        {ROLES.map((r) => {
          const active = role === r.key;
          return (
            <TouchableOpacity key={r.key} activeOpacity={0.9} onPress={() => setRole(r.key)}
              style={[styles.roleCard, active && { borderColor: r.color, backgroundColor: r.tint }]}>
              <IconBadge name={r.icon} color={r.color} tint={active ? colors.white : r.tint} size={46} iconSize={24} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.roleTitle}>{r.title}</Text>
                <Text style={styles.roleSub}>{r.sub}</Text>
              </View>
              <Icon name={active ? 'check-circle' : 'checkbox-blank-circle-outline'} size={22} color={active ? r.color : colors.border} />
            </TouchableOpacity>
          );
        })}

        <View style={{ height: spacing.md }} />
        <TextField label="Full name" leftIcon="user" placeholder="Your name" value={form.name} onChangeText={(v) => set('name', v)} error={errorFor('name')} />
        <TextField label="Mobile number" leftIcon="phone" placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} value={form.mobile} onChangeText={(v) => set('mobile', v)} error={errorFor('mobile')} />
        <TextField label="Email" leftIcon="email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => set('email', v)} error={errorFor('email')} />
        <TextField label="Password" leftIcon="lock" placeholder="••••••" secureTextEntry value={form.password} onChangeText={(v) => set('password', v)} error={errorFor('password')} />

        <Text style={styles.otpLabel}>Where should we send your OTP?</Text>
        <View style={styles.channelRow}>
          {[{ key: 'sms', label: '📱 Phone' }, { key: 'email', label: '✉️ Email' }].map((ch) => {
            const active = channel === ch.key;
            return (
              <TouchableOpacity key={ch.key} activeOpacity={0.85} onPress={() => setChannel(ch.key)}
                style={[styles.channelBtn, active && { borderColor: accent, backgroundColor: accentTint }]}>
                <Text style={[styles.channelText, active && { color: accent }]}>{ch.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.consent}>
          By continuing, you agree to our{' '}
          <Text style={{ color: accent, fontWeight: font.semibold }} onPress={() => navigation.navigate('Terms')}>Terms</Text>
          {' '}and{' '}
          <Text style={{ color: accent, fontWeight: font.semibold }} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>.
        </Text>

        <AppButton title={channel === 'email' ? 'Continue — verify email' : 'Continue — verify mobile'} icon="arrow" color={accent} onPress={onContinue} loading={loading} style={{ marginTop: spacing.sm }} />
        <View style={styles.footer}>
          <Text style={styles.muted}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={[styles.link, { color: accent }]}>Log in</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  roleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: colors.border },
  roleTitle: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  roleSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  muted: { color: colors.textMuted, fontSize: font.body },
  link: { color: colors.primary, fontWeight: font.bold, fontSize: font.body },
  otpLabel: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm, marginBottom: 6, fontWeight: font.medium },
  channelRow: { flexDirection: 'row', gap: spacing.sm },
  channelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  channelBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  channelText: { fontSize: font.body, fontWeight: font.semibold, color: colors.textMuted },
  channelTextActive: { color: colors.primary },
  consent: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center', lineHeight: 18 },
});
