import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { AuthApi } from '../../api';
import { errMessage } from '../../api/client';
import { Screen, AppButton, TextField } from '../../components/UI';
import { colors, spacing, font, radius } from '../../theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [channel, setChannel] = useState('sms'); // 'sms' | 'email'
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSend = async () => {
    const mobileClean = mobile.replace(/\D/g, '');
    const emailClean = email.trim().toLowerCase();
    if (channel === 'sms') {
      if (mobileClean.length < 10) return Alert.alert('Mobile', 'Enter a valid 10-digit mobile number.');
    } else if (!/^\S+@\S+\.\S+$/.test(emailClean)) {
      return Alert.alert('Email', 'Enter a valid email address.');
    }
    setLoading(true);
    try {
      const res = await AuthApi.forgotPasswordRequestOtp({ mobile: mobileClean, email: emailClean, channel });
      navigation.navigate('ResetPassword', { mobile: mobileClean, email: emailClean, channel, devCode: res?.data?.devCode });
    } catch (e) {
      Alert.alert('Could not send OTP', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.subtitle}>We'll send you a code to reset it.</Text>

        <Text style={styles.otpLabel}>Where should we send your OTP?</Text>
        <View style={styles.channelRow}>
          {[{ key: 'sms', label: '📱 Phone' }, { key: 'email', label: '✉️ Email' }].map((ch) => {
            const active = channel === ch.key;
            return (
              <TouchableOpacity key={ch.key} activeOpacity={0.85} onPress={() => setChannel(ch.key)}
                style={[styles.channelBtn, active && styles.channelBtnActive]}>
                <Text style={[styles.channelText, active && styles.channelTextActive]}>{ch.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: spacing.md }} />
        {channel === 'sms' ? (
          <TextField label="Mobile number" leftIcon="phone" placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} value={mobile} onChangeText={setMobile} />
        ) : (
          <TextField label="Email" leftIcon="email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
        )}

        <AppButton title="Send OTP" icon="arrow" onPress={onSend} loading={loading} style={{ marginTop: spacing.sm }} />

        <View style={styles.footer}>
          <Text style={styles.muted}>Remember your password? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>Log in</Text></TouchableOpacity>
        </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  muted: { color: colors.textMuted, fontSize: font.body },
  link: { color: colors.primary, fontWeight: font.bold, fontSize: font.body },
  otpLabel: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm, marginBottom: 6, fontWeight: font.medium },
  channelRow: { flexDirection: 'row', gap: spacing.sm },
  channelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  channelBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  channelText: { fontSize: font.body, fontWeight: font.semibold, color: colors.textMuted },
  channelTextActive: { color: colors.primary },
});
