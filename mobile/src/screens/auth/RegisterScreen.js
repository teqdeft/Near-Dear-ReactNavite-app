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
        mode: 'register', devCode: res?.data?.devCode,
        payload: { name: form.name.trim(), mobile, email: form.email.trim().toLowerCase(), password: form.password, role },
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
        <TextField label="Full name" leftIcon="user" placeholder="Your name" value={form.name} onChangeText={(v) => set('name', v)} />
        <TextField label="Mobile number" leftIcon="phone" placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} value={form.mobile} onChangeText={(v) => set('mobile', v)} />
        <TextField label="Email" leftIcon="email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => set('email', v)} />
        <View style={{ flexDirection: 'row' }}>
          <TextField style={{ flex: 1, marginRight: spacing.sm }} label="Password" leftIcon="lock" placeholder="••••••" secureTextEntry value={form.password} onChangeText={(v) => set('password', v)} />
          <TextField style={{ flex: 1 }} label="Confirm" leftIcon="lock" placeholder="••••••" secureTextEntry value={form.confirm} onChangeText={(v) => set('confirm', v)} />
        </View>

        <AppButton title="Continue — verify mobile" icon="arrow" onPress={onContinue} loading={loading} style={{ marginTop: spacing.sm }} />
        <View style={styles.footer}>
          <Text style={styles.muted}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>Log in</Text></TouchableOpacity>
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
});
