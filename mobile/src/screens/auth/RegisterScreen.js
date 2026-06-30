import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { AuthApi } from '../../api';
import { errMessage } from '../../api/client';
import { Screen, AppButton, TextField } from '../../components/UI';
import { colors, spacing, font, radius, shadow } from '../../theme';

const ROLES = [
  { key: 'user', emoji: '🙋', title: 'Normal User', sub: 'Request blood, ambulance & medicines — and donate blood' },
  { key: 'ambulance_driver', emoji: '🚑', title: 'Ambulance Driver', sub: 'Receive nearby ambulance requests and accept trips' },
];

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '', confirm: '' });
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onContinue = async () => {
    const mobile = form.mobile.replace(/\D/g, '');
    if (!form.name.trim()) return Alert.alert('Name', 'Please enter your full name.');
    if (mobile.length < 10) return Alert.alert('Mobile', 'Enter a valid 10-digit mobile number.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return Alert.alert('Email', 'Enter a valid email address.');
    if (form.password.length < 6) return Alert.alert('Password', 'Password must be at least 6 characters.');
    if (form.password !== form.confirm) return Alert.alert('Password', 'Passwords do not match.');

    setLoading(true);
    try {
      const res = await AuthApi.requestOtp(mobile);
      navigation.navigate('Otp', {
        mode: 'register',
        devCode: res?.data?.devCode,
        payload: {
          name: form.name.trim(),
          mobile,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role,
        },
      });
    } catch (e) {
      Alert.alert('Could not send OTP', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Pick how you want to use NearDear</Text>

        <View style={{ marginBottom: spacing.md }}>
          {ROLES.map((r) => {
            const active = role === r.key;
            return (
              <TouchableOpacity key={r.key} activeOpacity={0.9} onPress={() => setRole(r.key)}
                style={[styles.roleCard, shadow.soft, active && styles.roleCardActive]}>
                <View style={[styles.roleIcon, active && { backgroundColor: colors.primary }]}>
                  <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleTitle}>{r.title}</Text>
                  <Text style={styles.roleSub}>{r.sub}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextField label="Full name" placeholder="Your name" value={form.name} onChangeText={(v) => set('name', v)} />
        <TextField label="Mobile number" placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} value={form.mobile} onChangeText={(v) => set('mobile', v)} />
        <TextField label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => set('email', v)} />
        <View style={{ flexDirection: 'row' }}>
          <TextField style={{ flex: 1, marginRight: spacing.sm }} label="Password" placeholder="••••••" secureTextEntry value={form.password} onChangeText={(v) => set('password', v)} />
          <TextField style={{ flex: 1 }} label="Confirm" placeholder="••••••" secureTextEntry value={form.confirm} onChangeText={(v) => set('confirm', v)} />
        </View>

        <AppButton title="Continue — verify mobile" onPress={onContinue} loading={loading} style={{ marginTop: spacing.sm }} />
        <View style={styles.footer}>
          <Text style={styles.muted}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Log in</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  roleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  roleTitle: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  roleSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  muted: { color: colors.textMuted, fontSize: font.body },
  link: { color: colors.primary, fontWeight: font.bold, fontSize: font.body },
});
