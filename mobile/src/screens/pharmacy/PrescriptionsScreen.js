import React, { useState, useCallback } from 'react';
import { FlatList, View, Text, Image, Modal, StyleSheet, Alert, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { OrderApi } from '../../api';
import { errMessage, TOKEN_KEY } from '../../api/client';
import { API_BASE_URL } from '../../config';
import { useAuth } from '../../store/AuthContext';
import { Card, Pill, Muted, Row, AppButton, EmptyState, Loader } from '../../components/UI';
import Icon from '../../components/Icon';
import { formatDateTime } from '../../utils/datetime';
import { statusLabel } from '../../utils/status';
import { colors, spacing, font, radius } from '../../theme';

const STATUS_COLOR = { uploaded: colors.info, under_review: colors.warning, approved: colors.success, rejected: colors.danger };

export default function PrescriptionsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState(null); // prescription being previewed
  const [token, setToken] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await OrderApi.myPrescriptions()) || []); } catch (e) { setItems([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Private files need a Bearer header, which <Image> can send via `headers`.
  const openView = async (item) => {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    setToken(t);
    setImgLoading(true);
    setViewing(item);
  };
  const isPdf = viewing?.file_url?.toLowerCase().endsWith('.pdf');

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

  const list = (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={items}
      keyExtractor={(i) => String(i.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <AppButton title={uploading ? 'Uploading…' : 'Upload prescription'} icon="upload" color={colors.pharmacy}
          loading={uploading} onPress={upload} style={{ marginBottom: spacing.lg }} />
      }
      ListEmptyComponent={<EmptyState icon="prescription" title="No prescriptions yet" subtitle="Upload a prescription to use it at checkout." />}
      renderItem={({ item }) => (
        <Card style={styles.card} onPress={() => openView(item)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.title}>{(item.patient_name_snapshot || user?.name) ? `${item.patient_name_snapshot || user.name}'s Prescription` : 'Prescription'} #{item.id}</Text>
            <Pill label={statusLabel(item.status)} color={STATUS_COLOR[item.status] || colors.textMuted} />
          </Row>
          {(item.patient_mobile_snapshot || user?.mobile) ? <Muted style={{ marginTop: 4 }}>📞 +91 {item.patient_mobile_snapshot || user.mobile}</Muted> : null}
          {item.doctor_name ? <Muted style={{ marginTop: 4 }}>Dr. {item.doctor_name}</Muted> : null}
          {item.created_at ? <Muted style={{ marginTop: 4 }}>Uploaded: {formatDateTime(item.created_at)}</Muted> : null}
          {item.rejection_reason ? <Muted style={{ color: colors.danger, marginTop: 4 }}>Reason: {item.rejection_reason}</Muted> : null}
          <Row style={{ marginTop: 8, alignItems: 'center' }}>
            <Icon name="eye" size={16} color={colors.pharmacy} />
            <Text style={styles.viewHint}>Tap to view</Text>
          </Row>
        </Card>
      )}
    />
  );

  return (
    <>
      {list}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerBox}>
            <Text style={styles.viewerTitle} numberOfLines={1}>
              {viewing?.patient_name_snapshot || user?.name || 'Prescription'} • #{viewing?.id}
            </Text>
            <View style={styles.viewerImageWrap}>
              {isPdf ? (
                <Muted style={{ textAlign: 'center' }}>This prescription is a PDF and can’t be previewed here.</Muted>
              ) : viewing && token ? (
                <>
                  {imgLoading ? <ActivityIndicator color={colors.pharmacy} style={StyleSheet.absoluteFill} /> : null}
                  <Image
                    // Build the URL from the mobile's own API base (not the
                    // backend's absolute url, which may point at localhost). The
                    // token goes in the query string because <Image> can't send
                    // an Authorization header reliably on Android.
                    source={{ uri: `${API_BASE_URL}/files/${viewing.file_url}?token=${token}` }}
                    style={styles.viewerImage}
                    resizeMode="contain"
                    onLoadEnd={() => setImgLoading(false)}
                  />
                </>
              ) : null}
            </View>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewing(null)}>
              <Text style={styles.viewerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  viewHint: { color: colors.pharmacy, fontWeight: font.semibold, fontSize: font.tiny, marginLeft: 4 },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.lg },
  viewerBox: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, maxHeight: '85%' },
  viewerTitle: { fontSize: font.body, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  viewerImageWrap: { height: 420, borderRadius: radius.md, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: { marginTop: spacing.md, backgroundColor: colors.pharmacy, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  viewerCloseText: { color: colors.white, fontWeight: font.bold, fontSize: font.body },
});
