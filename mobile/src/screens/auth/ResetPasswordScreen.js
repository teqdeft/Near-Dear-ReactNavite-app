import React, { useState } from 'react';
import { Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { AuthApi } from '../../api';
import { errMessage } from '../../api/client';
import { Screen, AppButton, TextField, Muted } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

export default function ResetPasswordScreen({ route, navigation }) {
  const { mobile, email, channel = 'sms', devCode } = route.params || {};
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onReset = async () => {
    if (code.length !== 6) return Alert.alert('OTP', 'Please enter the 6-digit code.');
    if (password.length < 6) return Alert.alert('Password', 'Password must be at least 6 characters.');
    if (password !== confirm) return Alert.alert('Password', 'Passwords do not match.');
    setLoading(true);
    try {
      await AuthApi.forgotPasswordReset({ mobile, email, channel, code, newPassword: password });
      Alert.alert('Password reset', 'You can now log in with your new password.');
      navigation.navigate('Login');
    } catch (e) {
      Alert.alert('Reset failed', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>Reset password</Text>
        <Muted style={{ marginBottom: spacing.xl }}>
          Code sent to {channel === 'email' ? email : `+91 ${mobile}`}
          {devCode ? `  (dev code: ${devCode})` : ''}
        </Muted>

        <TextField label="OTP code" leftIcon="lock" placeholder="6-digit code" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
        <TextField label="New password" leftIcon="lock" placeholder="••••••" secureTextEntry value={password} onChangeText={setPassword} />
        <TextField label="Confirm password" leftIcon="lock" placeholder="••••••" secureTextEntry value={confirm} onChangeText={setConfirm} />

        <AppButton title="Reset password" onPress={onReset} loading={loading} style={{ marginTop: spacing.sm }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm, marginBottom: 4 },
});
