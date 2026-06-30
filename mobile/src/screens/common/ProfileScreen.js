import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../store/AuthContext';
import { ProfileApi } from '../../api';
import { errMessage } from '../../api/client';
import { Card, Pill, Muted, Row, AppButton, TextField } from '../../components/UI';
import { colors, spacing, font, radius } from '../../theme';

function MenuItem({ emoji, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.8}>
      <Text style={{ fontSize: 20, marginRight: spacing.md }}>{emoji}</Text>
      <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, profile, aadhaarVerified, logout, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState(profile?.city || '');
  const [saving, setSaving] = useState(false);

  const initials = (user?.name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const save = async () => {
    setSaving(true);
    try {
      await ProfileApi.update({ name: name.trim(), city: city.trim() });
      await refreshUser();
      setEditing(false);
    } catch (e) { Alert.alert('Error', errMessage(e)); }
    finally { setSaving(false); }
  };

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const requestDeletion = () => {
    Alert.alert('Delete account', 'This sends a data deletion request to our team. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Request deletion', style: 'destructive', onPress: async () => {
        try { await ProfileApi.requestDeletion('User requested deletion from app'); Alert.alert('Submitted', 'We will process your request.'); }
        catch (e) { Alert.alert('Error', errMessage(e)); }
      } },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.name}>{user?.name || 'NearDear User'}</Text>
          <Muted>+91 {user?.mobile}</Muted>
          <Row style={{ marginTop: spacing.sm }}>
            {aadhaarVerified
              ? <Pill label="🛡️ Aadhaar Verified" color={colors.success} />
              : <Pill label="Aadhaar not verified" color={colors.warning} />}
            {profile?.blood_group ? <Pill label={profile.blood_group} color={colors.blood} style={{ marginLeft: 8 }} /> : null}
          </Row>
        </View>

        {!aadhaarVerified && (
          <AppButton title="🛡️ Verify Aadhaar now" onPress={() => navigation.navigate('AadhaarVerify')} style={{ marginBottom: spacing.lg }} />
        )}

        {editing ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <TextField label="Name" value={name} onChangeText={setName} />
            <TextField label="City" value={city} onChangeText={setCity} />
            <Row>
              <AppButton title="Save" loading={saving} onPress={save} style={{ flex: 1, marginRight: spacing.sm }} />
              <AppButton title="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            </Row>
          </Card>
        ) : null}

        <Card style={styles.menu}>
          <MenuItem emoji="✏️" label="Edit profile" onPress={() => setEditing(true)} />
          <MenuItem emoji="🩸" label="Donor profile" onPress={() => navigation.navigate('BecomeDonor')} />
          <MenuItem emoji="📄" label="My prescriptions" onPress={() => navigation.navigate('Prescriptions')} />
          <MenuItem emoji="🧾" label="My orders" onPress={() => navigation.navigate('Orders')} />
          <MenuItem emoji="💬" label="Support" onPress={() => navigation.navigate('Support')} />
        </Card>

        <Card style={styles.menu}>
          <MenuItem emoji="🚪" label="Log out" onPress={confirmLogout} danger />
          <MenuItem emoji="🗑️" label="Request account deletion" onPress={requestDeletion} danger />
        </Card>

        <Muted style={{ textAlign: 'center', marginTop: spacing.lg }}>NearDear • MVP v1.0</Muted>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { color: colors.white, fontSize: font.h2, fontWeight: font.bold },
  name: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  menu: { padding: 0, overflow: 'hidden', marginBottom: spacing.lg },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLabel: { flex: 1, fontSize: font.body, color: colors.text, fontWeight: font.medium },
  chev: { fontSize: 22, color: colors.textMuted },
});
