import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { AppButton, TextField } from '../../components/UI';
import { colors, spacing, font, radius } from '../../theme';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }
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
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoCircle}><Text style={styles.logoEmoji}>❤️</Text></View>
            <Text style={styles.brand}>NearDear</Text>
            <Text style={styles.tagline}>Help that's always near — blood, ambulance & medicines</Text>
          </View>

          <View style={styles.sheet}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to continue</Text>

            <TextField
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <AppButton title="Log in" onPress={onLogin} loading={loading} style={{ marginTop: spacing.sm }} />

            <View style={styles.footer}>
              <Text style={styles.muted}>New to NearDear? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.link}>Create an account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  hero: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl * 1.4 },
  logoCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  logoEmoji: { fontSize: 42 },
  brand: { fontSize: 34, fontWeight: font.bold, color: colors.white, letterSpacing: 0.5 },
  tagline: { color: '#D7F4EF', fontSize: font.body, marginTop: spacing.sm, textAlign: 'center', paddingHorizontal: spacing.xl },
  sheet: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingTop: spacing.xxl },
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  muted: { color: colors.textMuted, fontSize: font.body },
  link: { color: colors.primary, fontWeight: font.bold, fontSize: font.body },
});
