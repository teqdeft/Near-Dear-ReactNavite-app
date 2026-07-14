import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAuth } from '../../store/AuthContext';
import { ProfileApi } from '../../api';
import { errMessage } from '../../api/client';
import { Card, Pill, Muted, Row, AppButton, TextField, ListRow } from '../../components/UI';
import Icon from '../../components/Icon';
import ProfileAvatar from '../../components/ProfileAvatar';
import CityChipsInput from '../../components/CityChipsInput';
import { colors, spacing, font, radius } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const { user, profile, aadhaarVerified, isDriver, logout, refreshUser } = useAuth();
  const aadhaarPending = user?.aadhaar_kyc_status === 'pending';
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState(profile?.city || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Aadhaar KYC is approved by an admin, not by anything the user does here — so
  // a pull is the only way they can find out it went through without restarting
  // the app.
  const onRefresh = async () => {
    setRefreshing(true);
    try { await refreshUser(); } catch (e) { /* keep what we have */ }
    setRefreshing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await ProfileApi.update({ name: name.trim(), city: city.trim() });
      await refreshUser();
      setEditing(false);
    } catch (e) { Alert.alert('Error', errMessage(e)); } finally { setSaving(false); }
  };

  // Pick a profile photo from the camera or gallery, upload it, then refresh so
  // the new avatar shows here and on the home screen.
  const uploadPhoto = async (from) => {
    const opts = { mediaType: 'photo', quality: 0.7, maxWidth: 1000, maxHeight: 1000 };
    try {
      const result = from === 'camera' ? await launchCamera(opts) : await launchImageLibrary(opts);
      if (result.didCancel) return;
      if (result.errorCode) { Alert.alert('Error', result.errorMessage || 'Could not open the camera or gallery.'); return; }
      const asset = result.assets && result.assets[0];
      if (!asset || !asset.uri) return;
      setUploadingPhoto(true);
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: asset.fileName || 'avatar.jpg', type: asset.type || 'image/jpeg' });
      await ProfileApi.uploadAvatar(form);
      await refreshUser();
    } catch (e) { Alert.alert('Upload failed', errMessage(e)); }
    finally { setUploadingPhoto(false); }
  };

  const choosePhoto = () => Alert.alert('Profile photo', 'Add a photo from', [
    { text: 'Camera', onPress: () => uploadPhoto('camera') },
    { text: 'Gallery', onPress: () => uploadPhoto('gallery') },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const confirmLogout = () => Alert.alert('Log out', 'Are you sure you want to log out?', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: logout },
  ]);

  const requestDeletion = () => Alert.alert('Delete account', 'This sends a data deletion request to our team. Continue?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Request deletion', style: 'destructive', onPress: async () => {
      try { await ProfileApi.requestDeletion('User requested deletion from app'); Alert.alert('Submitted', 'We will process your request.'); }
      catch (e) { Alert.alert('Error', errMessage(e)); }
    } },
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={isDriver ? colors.ambulance : colors.primary}
            colors={[isDriver ? colors.ambulance : colors.primary]} />
        )}>
        <View style={styles.headerCard}>
          <TouchableOpacity activeOpacity={0.85} onPress={choosePhoto} disabled={uploadingPhoto}>
            <ProfileAvatar path={profile?.profile_image} name={user?.name} size={84}
              color={isDriver ? colors.ambulance : colors.primary} />
            <View style={[styles.camBadge, { backgroundColor: isDriver ? colors.ambulance : colors.primary }]}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Icon name="camera" size={15} color={colors.white} />}
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{user?.name || 'NearDear User'}</Text>
          <Row><Icon name="phone" size={14} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>+91 {user?.mobile}</Muted></Row>
          <Row style={{ marginTop: spacing.sm }}>
            {aadhaarVerified
              ? <Pill label="Aadhaar Verified" color={colors.success} icon="shield" />
              : aadhaarPending
                ? <Pill label="Aadhaar under review" color={colors.warning} icon="clock" />
                : <Pill label="Aadhaar not verified" color={colors.warning} icon="alert" />}
            {profile?.blood_group ? <Pill label={profile.blood_group} color={colors.blood} style={{ marginLeft: 8 }} /> : null}
          </Row>
        </View>

        {!aadhaarVerified && (
          <AppButton
            title={aadhaarPending ? 'View verification status' : 'Verify Aadhaar now'}
            icon={aadhaarPending ? 'clock' : 'shield'}
            color={isDriver ? colors.ambulance : colors.primary}
            onPress={() => navigation.navigate('AadhaarUpload')}
            style={{ marginBottom: spacing.lg }}
          />
        )}

        {editing ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <TextField label="Name" leftIcon="user" value={name} onChangeText={setName} />
            {isDriver ? (
              // A driver covers an area, not a single city — let them list each one.
              <CityChipsInput label="Service cities" value={city} onChange={setCity} color={colors.ambulance} />
            ) : (
              <TextField label="City" leftIcon="location" value={city} onChangeText={setCity} />
            )}
            <Row>
              <AppButton title="Save" color={isDriver ? colors.ambulance : colors.primary} loading={saving} onPress={save} style={{ flex: 1, marginRight: spacing.sm }} />
              <AppButton title="Cancel" variant="outline" color={isDriver ? colors.ambulance : colors.primary} onPress={() => setEditing(false)} style={{ flex: 1 }} />
            </Row>
          </Card>
        ) : null}

        <Card style={styles.menu}>
          <ListRow icon="edit" title="Edit profile" onPress={() => setEditing(true)} />
          <ListRow icon="lock" title="Change password" onPress={() => navigation.navigate('ChangePassword')} />
          {isDriver && <ListRow icon="ambulance" title="My ambulance" onPress={() => navigation.navigate('DriverVehicle')} />}
          {!isDriver && <ListRow icon="donor" iconColor={colors.blood} title="Donor profile" onPress={() => navigation.navigate('BecomeDonor')} />}
          {!isDriver && <ListRow icon="prescription" iconColor={colors.pharmacy} title="My prescriptions" onPress={() => navigation.navigate('Prescriptions')} />}
          {!isDriver && <ListRow icon="orders" title="My orders" onPress={() => navigation.navigate('Orders')} />}
          <ListRow icon="alert" iconColor={colors.danger} title="Emergency Help" onPress={() => navigation.navigate('EmergencyHelp')} />
          <ListRow icon="support" iconColor={colors.ambulance} title="Support" onPress={() => navigation.navigate('Support')} />
          <ListRow icon="shield" title="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
          <ListRow icon="prescription" title="Terms & Conditions" onPress={() => navigation.navigate('Terms')} last />
        </Card>

        <Card style={styles.menu}>
          <ListRow icon="logout" title="Log out" danger onPress={confirmLogout} right={<Icon name="next" size={22} color={colors.danger} />} />
          <ListRow icon="trash" title="Request account deletion" danger last onPress={requestDeletion} right={<Icon name="next" size={22} color={colors.danger} />} />
        </Card>

        <Muted style={{ textAlign: 'center', marginTop: spacing.lg }}>NearDear • MVP v1.0</Muted>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  camBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface,
  },
  name: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, marginTop: spacing.md, marginBottom: 4 },
  menu: { paddingVertical: 0, marginBottom: spacing.lg },
});
