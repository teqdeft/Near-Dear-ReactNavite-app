import React, { useState } from 'react';
import { Text, StyleSheet, Alert } from 'react-native';
import { AuthApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Screen, AppButton, TextField } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

export default function ChangePasswordScreen({ navigation }) {
  const { isDriver } = useAuth();
  const accent = isDriver ? colors.ambulance : colors.primary;
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onUpdate = async () => {
    if (!current || !password || !confirm) return Alert.alert('Missing details', 'Please fill in all password fields.');
    if (password.length < 6) return Alert.alert('Password', 'Password must be at least 6 characters.');
    if (password !== confirm) return Alert.alert('Password', 'Passwords do not match.');
    setLoading(true);
    try {
      await AuthApi.changePassword({ currentPassword: current, newPassword: password });
      Alert.alert('Done', 'Your password has been changed.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not change password', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
        <Text style={styles.title}>Change password</Text>

        <TextField label="Current password" leftIcon="lock" placeholder="••••••" secureTextEntry value={current} onChangeText={setCurrent} />
        <TextField label="New password" leftIcon="lock" placeholder="••••••" secureTextEntry value={password} onChangeText={setPassword} />
        <TextField label="Confirm new password" leftIcon="lock" placeholder="••••••" secureTextEntry value={confirm} onChangeText={setConfirm} />

        <AppButton title="Update password" color={accent} onPress={onUpdate} loading={loading} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.lg },
});
