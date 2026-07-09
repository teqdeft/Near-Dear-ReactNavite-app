import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { AuthApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Screen, AppButton, Card, Pill, Muted, IconBadge, Row } from '../../components/UI';
import Icon from '../../components/Icon';
import { colors, spacing, font, radius } from '../../theme';

/**
 * Manual Aadhaar KYC: the user captures / uploads photos of the front and back
 * of their Aadhaar card, which are sent to an admin for manual verification.
 * (The automated Aadhaar OTP flow still lives in AadhaarVerifyScreen.)
 */
export default function AadhaarUploadScreen({ navigation }) {
  const { user, refreshUser, isDriver } = useAuth();
  // Ambulance drivers run on the blue module theme — keep the verify flow's
  // accent blue for them so it matches, instead of the default green.
  const accent = isDriver ? colors.ambulance : colors.primary;
  const [front, setFront] = useState(null); // picked asset { uri, fileName, type }
  const [back, setBack] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submission, setSubmission] = useState(null); // { status, rejection_reason }
  const [kycStatus, setKycStatus] = useState(user?.aadhaar_kyc_status || 'none');

  const loadStatus = useCallback(async () => {
    try {
      const res = await AuthApi.aadhaarManualStatus();
      setKycStatus(res?.kyc_status || 'none');
      setSubmission(res?.submission || null);
    } catch (e) {
      /* keep whatever we have — the upload UI still works offline-ish */
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Refresh on focus so an admin's decision reflects when the user returns.
  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));

  // AuthContext polls /me while KYC is pending; mirror that status here so this
  // screen flips from "Under review" to "Verified" live, even if left open.
  useEffect(() => {
    if (user?.aadhaar_kyc_status) setKycStatus(user.aadhaar_kyc_status);
  }, [user?.aadhaar_kyc_status]);

  const pick = async (side, from) => {
    const opts = { mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600 };
    try {
      const result = from === 'camera' ? await launchCamera(opts) : await launchImageLibrary(opts);
      if (result.didCancel) return;
      if (result.errorCode) { Alert.alert('Error', result.errorMessage || 'Could not open the camera or gallery.'); return; }
      const asset = result.assets && result.assets[0];
      if (!asset || !asset.uri) return;
      const value = { uri: asset.uri, name: asset.fileName || `aadhaar-${side}.jpg`, type: asset.type || 'image/jpeg' };
      if (side === 'front') setFront(value); else setBack(value);
    } catch (e) {
      Alert.alert('Error', errMessage(e));
    }
  };

  const choose = (side) => Alert.alert(
    side === 'front' ? 'Aadhaar front' : 'Aadhaar back',
    'Add a photo from',
    [
      { text: 'Camera', onPress: () => pick(side, 'camera') },
      { text: 'Gallery', onPress: () => pick(side, 'gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]
  );

  const submit = async () => {
    if (!front || !back) { Alert.alert('Both photos needed', 'Please add both the front and back of your Aadhaar card.'); return; }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('front', front);
      form.append('back', back);
      await AuthApi.aadhaarManualSubmit(form);
      await refreshUser();
      await loadStatus();
      setFront(null);
      setBack(null);
      Alert.alert('Submitted ✅', 'Your Aadhaar has been sent for verification. We will notify you once it is reviewed.');
    } catch (e) {
      Alert.alert('Upload failed', errMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <Screen>
        <View style={styles.centre}><ActivityIndicator color={colors.primary} /></View>
      </Screen>
    );
  }

  // Already verified.
  if (kycStatus === 'verified') {
    return (
      <Screen>
        <Card style={styles.stateCard}>
          <View style={[styles.stateIcon, { backgroundColor: colors.pharmacyLight }]}>
            <Icon name="shield" size={44} color={colors.success} />
          </View>
          <Text style={styles.stateTitle}>Aadhaar Verified</Text>
          <Pill label="KYC Verified" color={colors.success} />
          <Muted style={{ textAlign: 'center', marginTop: spacing.md }}>
            Your identity is verified. This builds trust with donors, pharmacies and our team.
          </Muted>
          <AppButton title="Done" color={accent} onPress={() => navigation.goBack()} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  // Submitted and awaiting admin review.
  if (submission && submission.status === 'pending') {
    return (
      <Screen>
        <Card style={styles.stateCard}>
          <View style={[styles.stateIcon, { backgroundColor: '#FFF4E0' }]}>
            <Icon name="clock" size={40} color={colors.warning} />
          </View>
          <Text style={styles.stateTitle}>Under review</Text>
          <Pill label="Pending verification" color={colors.warning} />
          <Muted style={{ textAlign: 'center', marginTop: spacing.md }}>
            Your Aadhaar photos have been submitted. Our team will verify them shortly and you'll get a
            notification once it's done.
          </Muted>
          <AppButton title="Done" variant="ghost" color={accent} onPress={() => navigation.goBack()} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  // Not verified: show the upload form (with the rejection reason, if any).
  return (
    <Screen scroll>
      <Card style={{ marginBottom: spacing.lg }}>
        <Row><IconBadge name="lock" color={accent} size={40} iconSize={20} /><Text style={styles.infoTitle}>  Verify your identity</Text></Row>
        <Muted style={{ marginTop: spacing.sm }}>
          Upload clear photos of the front and back of your Aadhaar card. Our team will review and verify
          them. Your documents stay private and are visible only to our verification team.
        </Muted>
      </Card>

      {submission && submission.status === 'rejected' && submission.rejection_reason ? (
        <Card style={[styles.rejectCard]}>
          <Row><Icon name="alert" size={18} color={colors.blood} /><Text style={styles.rejectTitle}>  Previous submission rejected</Text></Row>
          <Muted style={{ marginTop: 4 }}>{submission.rejection_reason}</Muted>
        </Card>
      ) : null}

      <UploadSlot label="Aadhaar — Front" asset={front} onPress={() => choose('front')} accent={accent} />
      <UploadSlot label="Aadhaar — Back" asset={back} onPress={() => choose('back')} accent={accent} />

      <AppButton
        title="Submit for verification"
        color={accent}
        onPress={submit}
        loading={submitting}
        disabled={!front || !back}
        style={{ marginTop: spacing.md }}
      />
    </Screen>
  );
}

function UploadSlot({ label, asset, onPress, accent = colors.primary }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.slotLabel}>{label}</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.slot}>
        {asset ? (
          <>
            <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.changePill}>
              <Icon name="camera" size={14} color={colors.white} />
              <Text style={styles.changeText}>Change</Text>
            </View>
          </>
        ) : (
          <View style={styles.slotEmpty}>
            <IconBadge name="upload" color={accent} size={46} iconSize={22} />
            <Text style={styles.slotHint}>Tap to capture or upload</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { paddingVertical: spacing.xxl, alignItems: 'center' },
  infoTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },

  slotLabel: { fontSize: font.small, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
  slot: {
    borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border || '#E6E8EC', borderStyle: 'dashed',
    minHeight: 170,
  },
  slotEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  slotHint: { color: colors.textMuted, fontSize: font.small },
  preview: { width: '100%', height: 190 },
  changePill: {
    position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
  },
  changeText: { color: colors.white, fontSize: font.tiny, fontWeight: font.bold },

  rejectCard: { marginBottom: spacing.lg, backgroundColor: colors.bloodLight || '#FDECEC' },
  rejectTitle: { fontSize: font.small, fontWeight: font.bold, color: colors.blood },

  stateCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  stateIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  stateTitle: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, marginVertical: spacing.sm },
});
