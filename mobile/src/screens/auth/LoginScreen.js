import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { AppButton, TextField } from '../../components/UI';
import Icon from '../../components/Icon';
import { colors, spacing, font, radius } from '../../theme';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !password) return Alert.alert('Missing details', 'Please enter your email and password.');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      Alert.alert('Login failed', errMessage(e, 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <View style={styles.logo}><Icon name="blood" size={30} color={colors.white} /></View>
            <Text style={styles.brand}>NearDear</Text>
          </View>

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to continue</Text>

            <TextField label="Email" leftIcon="email" placeholder="you@example.com"
              keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <TextField label="Password" leftIcon="lock" placeholder="••••••••"
              secureTextEntry value={password} onChangeText={setPassword} />

            <AppButton title="Log in" onPress={onLogin} loading={loading} style={{ marginTop: spacing.sm }} />

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={{ alignItems: 'center', marginTop: spacing.md }}>
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.muted}>New to NearDear? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.link}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  brand: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  muted: { color: colors.textMuted, fontSize: font.body },
  link: { color: colors.primary, fontWeight: font.bold, fontSize: font.body },
});
