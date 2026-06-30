import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { AuthApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Screen, AppButton, Muted } from '../../components/UI';
import { colors, spacing, font, radius } from '../../theme';

const LEN = 6;

export default function OtpScreen({ route }) {
  const { mode = 'register', payload, devCode } = route.params || {};
  const mobile = payload?.mobile || route.params?.mobile;
  const { completeLogin, register } = useAuth();
  const [digits, setDigits] = useState(Array(LEN).fill(''));
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const inputs = useRef([]);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const onChange = (text, idx) => {
    const val = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    if (val && idx < LEN - 1) inputs.current[idx + 1]?.focus();
  };

  const onKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const verify = async () => {
    const code = digits.join('');
    if (code.length < LEN) {
      Alert.alert('Enter OTP', `Please enter the ${LEN}-digit code.`);
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        // Registration: verify OTP + create the account in one step.
        await register({ ...payload, code });
      } else {
        const res = await AuthApi.verifyOtp(mobile, code);
        await completeLogin(res);
      }
      // navigation switches automatically based on auth state
    } catch (e) {
      Alert.alert('Verification failed', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await AuthApi.requestOtp(mobile);
      setSeconds(30);
      Alert.alert('OTP sent', 'A new code has been sent.');
    } catch (e) {
      Alert.alert('Error', errMessage(e));
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>Enter the 6-digit code</Text>
      <Muted style={{ marginBottom: spacing.xl }}>
        Sent to +91 {mobile}
        {devCode ? `  (dev code: ${devCode})` : ''}
      </Muted>

      <View style={styles.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => (inputs.current[i] = r)}
            style={[styles.box, d && styles.boxFilled]}
            keyboardType="number-pad"
            maxLength={1}
            value={d}
            onChangeText={(t) => onChange(t, i)}
            onKeyPress={(e) => onKeyPress(e, i)}
          />
        ))}
      </View>

      <AppButton title="Verify & Continue" onPress={verify} loading={loading} style={{ marginTop: spacing.xl }} />

      <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
        {seconds > 0 ? (
          <Muted>Resend code in 0:{String(seconds).padStart(2, '0')}</Muted>
        ) : (
          <Text style={styles.resend} onPress={resend}>Resend OTP</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, marginTop: spacing.md },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  box: {
    width: 48, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, textAlign: 'center', fontSize: 22, fontWeight: font.bold, color: colors.text,
  },
  boxFilled: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  resend: { color: colors.primary, fontWeight: font.semibold, fontSize: font.body },
});
