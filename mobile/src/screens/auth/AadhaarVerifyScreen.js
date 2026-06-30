import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { AuthApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Screen, AppButton, TextField, Card, Pill, Muted } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

/**
 * Two-step Aadhaar OTP KYC:
 *  1) enter 12-digit Aadhaar -> OTP sent to the linked mobile
 *  2) enter that OTP -> verified
 */
export default function AadhaarVerifyScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(user?.aadhaar_kyc_status === 'verified' ? 'done' : 'enter');
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [last4, setLast4] = useState(null);
  const [devOtp, setDevOtp] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    const clean = aadhaar.replace(/\s/g, '');
    if (clean.length !== 12) {
      Alert.alert('Invalid Aadhaar', 'Aadhaar number must be 12 digits.');
      return;
    }
    setLoading(true);
    try {
      const res = await AuthApi.aadhaarGenerateOtp(clean);
      setLast4(res.last4);
      setDevOtp(res.devOtp);
      setStep('otp');
    } catch (e) {
      Alert.alert('Could not send OTP', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (otp.length < 4) {
      Alert.alert('Enter OTP', 'Please enter the OTP sent to your Aadhaar-linked mobile.');
      return;
    }
    setLoading(true);
    try {
      await AuthApi.aadhaarVerify(otp);
      await refreshUser();
      setStep('done');
      Alert.alert('Verified ✅', 'Your Aadhaar has been verified successfully.');
    } catch (e) {
      Alert.alert('Verification failed', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <Screen>
        <Card style={styles.doneCard}>
          <Text style={{ fontSize: 56 }}>🛡️</Text>
          <Text style={styles.doneTitle}>Aadhaar Verified</Text>
          <Pill label="KYC Verified" color={colors.success} />
          <Muted style={{ textAlign: 'center', marginTop: spacing.md }}>
            Your identity is verified. This builds trust with donors, pharmacies and our team.
          </Muted>
          <AppButton title="Done" onPress={() => navigation.goBack()} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.infoTitle}>🔐 Verify your identity</Text>
        <Muted style={{ marginTop: 4 }}>
          We use Aadhaar OTP verification. We never store your full Aadhaar number — only a verified
          status and the last 4 digits.
        </Muted>
      </Card>

      {step === 'enter' ? (
        <>
          <TextField
            label="Aadhaar number"
            placeholder="1234 5678 9012"
            keyboardType="number-pad"
            maxLength={12}
            value={aadhaar}
            onChangeText={setAadhaar}
          />
          <AppButton title="Send OTP" onPress={sendOtp} loading={loading} />
        </>
      ) : (
        <>
          <Muted style={{ marginBottom: spacing.md }}>
            OTP sent to the mobile linked with Aadhaar ending {last4}.
            {devOtp ? `  (dev OTP: ${devOtp})` : ''}
          </Muted>
          <TextField
            label="Enter OTP"
            placeholder="6-digit OTP"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
          <AppButton title="Verify Aadhaar" onPress={verify} loading={loading} />
          <AppButton title="Change Aadhaar number" variant="ghost" onPress={() => setStep('enter')} style={{ marginTop: spacing.sm }} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  doneCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  doneTitle: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, marginVertical: spacing.sm },
});
