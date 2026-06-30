import React, { useState, useCallback } from 'react';
import { FlatList, Text, StyleSheet, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { OrderApi } from '../../api';
import { errMessage } from '../../api/client';
import { Card, Pill, Muted, Row, AppButton, EmptyState, Loader } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

const STATUS_COLOR = { uploaded: colors.info, under_review: colors.warning, approved: colors.success, rejected: colors.danger };

export default function PrescriptionsScreen() {
  const [items, setItems] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await OrderApi.myPrescriptions()) || []); } catch (e) { setItems([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const upload = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7 });
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: asset.fileName || 'prescription.jpg', type: asset.type || 'image/jpeg' });
      await OrderApi.uploadPrescription(form);
      await load();
    } catch (e) {
      Alert.alert('Upload failed', errMessage(e));
    } finally {
      setUploading(false);
    }
  };

  if (items === null) return <Loader />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={items}
      keyExtractor={(i) => String(i.id)}
      ListHeaderComponent={
        <AppButton title={uploading ? 'Uploading…' : '⬆️ Upload prescription'} color={colors.pharmacy}
          loading={uploading} onPress={upload} style={{ marginBottom: spacing.lg }} />
      }
      ListEmptyComponent={<EmptyState icon="📄" title="No prescriptions yet" subtitle="Upload a prescription to use it at checkout." />}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.title}>📄 Prescription #{item.id}</Text>
            <Pill label={item.status.replace('_', ' ')} color={STATUS_COLOR[item.status] || colors.textMuted} />
          </Row>
          {item.doctor_name ? <Muted style={{ marginTop: 4 }}>Dr. {item.doctor_name}</Muted> : null}
          {item.rejection_reason ? <Muted style={{ color: colors.danger, marginTop: 4 }}>Reason: {item.rejection_reason}</Muted> : null}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
});
