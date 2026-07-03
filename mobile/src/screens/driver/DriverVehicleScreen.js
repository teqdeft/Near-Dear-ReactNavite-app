import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { AmbulanceApi } from '../../api';
import { errMessage } from '../../api/client';
import { Screen, AppButton, TextField, SectionTitle, Chip, Card, Pill, Muted, Row, Loader } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

const AMB_TYPES = [
  { value: 'basic', label: 'Basic' },
  { value: 'oxygen', label: 'Oxygen' },
  { value: 'icu', label: 'ICU' },
  { value: 'other', label: 'Other' },
];

// Documents collected at registration (RC + Driving License are mandatory).
const REG_DOCS = [
  { value: 'rc', label: 'Vehicle RC', required: true },
  { value: 'driving_license', label: 'Driving License', required: true },
  { value: 'permit', label: 'Permit', required: false },
  { value: 'insurance', label: 'Insurance', required: false },
];

const DOC_LABEL = {
  rc: 'RC', driving_license: 'License', permit: 'Permit', insurance: 'Insurance', vehicle_photo: 'Vehicle photo', other: 'Document',
};

const STATUS_COLOR = { approved: colors.success, pending: colors.warning, rejected: colors.danger };

async function pickImage() {
  const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7 });
  if (result.didCancel) return null;
  return result.assets?.[0] || null;
}

function assetForm(documentType, asset) {
  const form = new FormData();
  form.append('document_type', documentType);
  form.append('file', { uri: asset.uri, name: asset.fileName || 'document.jpg', type: asset.type || 'image/jpeg' });
  return form;
}

export default function DriverVehicleScreen({ navigation }) {
  const [data, setData] = useState(undefined); // undefined = loading, null = not registered
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [ambType, setAmbType] = useState('basic');
  const [docs, setDocs] = useState({}); // { [docType]: asset } picked during registration
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState('rc');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      setData((await AmbulanceApi.myVehicle()) || null);
    } catch (e) {
      setData(null);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickDoc = async (type) => {
    const asset = await pickImage();
    if (asset) setDocs((prev) => ({ ...prev, [type]: asset }));
  };

  // Combined registration: save the vehicle AND upload its documents in one go,
  // so the admin only gets a request once documents are attached.
  const submitRegistration = async () => {
    if (!vehicleNumber.trim()) return Alert.alert('Vehicle number', 'Please enter your vehicle number.');
    const missing = REG_DOCS.filter((d) => d.required && !docs[d.value]);
    if (missing.length) {
      return Alert.alert('Documents required', `Please upload: ${missing.map((d) => d.label).join(', ')}.`);
    }
    setSaving(true);
    try {
      await AmbulanceApi.registerVehicle({ vehicle_number: vehicleNumber.trim(), ambulance_type: ambType });
      for (const d of REG_DOCS) {
        const asset = docs[d.value];
        if (!asset) continue;
        // eslint-disable-next-line no-await-in-loop
        await AmbulanceApi.uploadVehicleDocument(assetForm(d.value, asset));
      }
      Alert.alert('Submitted ✅', 'Your ambulance and documents were sent for admin approval.');
      await load();
    } catch (e) {
      Alert.alert('Error', errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // Add a single extra document after registration (e.g. after a rejection).
  const uploadOne = async () => {
    const asset = await pickImage();
    if (!asset) return;
    setUploading(true);
    try {
      await AmbulanceApi.uploadVehicleDocument(assetForm(docType, asset));
      await load();
    } catch (e) {
      Alert.alert('Upload failed', errMessage(e));
    } finally {
      setUploading(false);
    }
  };

  if (data === undefined) return <Loader />;

  // ---- No vehicle: combined registration form -------------------------
  if (data === null) {
    return (
      <Screen scroll>
        <SectionTitle>Register your ambulance</SectionTitle>
        <Muted style={{ marginBottom: spacing.md }}>
          Enter your vehicle details and upload your documents. They’ll be sent to the admin for approval before you can accept rides.
        </Muted>

        <TextField
          label="Vehicle number *"
          value={vehicleNumber}
          onChangeText={setVehicleNumber}
          placeholder="PB01AB1234"
          autoCapitalize="characters"
        />

        <SectionTitle>Ambulance type</SectionTitle>
        <View style={styles.chips}>
          {AMB_TYPES.map((t) => (
            <Chip key={t.value} label={t.label} active={ambType === t.value} color={colors.ambulance} onPress={() => setAmbType(t.value)} />
          ))}
        </View>

        <SectionTitle>Documents</SectionTitle>
        <Muted style={{ marginBottom: spacing.sm }}>RC and Driving License are required. Upload clear photos.</Muted>
        {REG_DOCS.map((d) => (
          <Card key={d.value} style={styles.docPick}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>{d.label}{d.required ? ' *' : ''}</Text>
                {docs[d.value] ? <Muted style={{ color: colors.success, marginTop: 2 }}>✓ Selected</Muted> : null}
              </View>
              <AppButton
                title={docs[d.value] ? 'Change' : 'Pick image'}
                variant="outline"
                color={colors.ambulance}
                onPress={() => pickDoc(d.value)}
              />
            </Row>
          </Card>
        ))}

        <AppButton title="Submit for approval" color={colors.ambulance} onPress={submitRegistration} loading={saving} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  // ---- Vehicle exists -------------------------------------------------
  const { vehicle, documents } = data;
  const status = vehicle.approval_status;

  return (
    <Screen scroll>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.vehicleNumber}>{vehicle.vehicle_number}</Text>
          <Pill label={status} color={STATUS_COLOR[status] || colors.textMuted} />
        </Row>
        <Muted style={{ marginTop: 4, textTransform: 'capitalize' }}>{vehicle.ambulance_type} ambulance</Muted>

        {status === 'pending' ? (
          <Muted style={{ marginTop: spacing.sm }}>
            Your vehicle is awaiting admin approval. You can add more documents below.
          </Muted>
        ) : null}
        {status === 'rejected' && vehicle.rejection_reason ? (
          <Text style={[styles.statusLine, { color: colors.danger }]}>
            Rejected: {vehicle.rejection_reason}. Please add a document to re-submit.
          </Text>
        ) : null}
        {status === 'approved' ? (
          <Text style={[styles.statusLine, { color: colors.success }]}>
            Approved — you can now accept rides.
          </Text>
        ) : null}
      </Card>

      <View style={{ height: spacing.lg }} />

      <SectionTitle>Documents</SectionTitle>
      {documents && documents.length ? (
        documents.map((doc) => (
          <Card key={String(doc.id)} style={styles.docCard}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.docLabel}>{DOC_LABEL[doc.document_type] || doc.document_type}</Text>
              <Pill label={doc.status} color={STATUS_COLOR[doc.status] || colors.textMuted} />
            </Row>
          </Card>
        ))
      ) : (
        <Muted style={{ marginBottom: spacing.md }}>No documents uploaded yet.</Muted>
      )}

      <View style={{ height: spacing.sm }} />

      <SectionTitle>Add another document</SectionTitle>
      <View style={styles.chips}>
        {REG_DOCS.concat([{ value: 'vehicle_photo', label: 'Vehicle photo' }]).map((d) => (
          <Chip key={d.value} label={d.label} active={docType === d.value} color={colors.ambulance} onPress={() => setDocType(d.value)} />
        ))}
      </View>

      <AppButton
        title={uploading ? 'Uploading…' : 'Upload document'}
        icon="upload"
        color={colors.ambulance}
        loading={uploading}
        onPress={uploadOne}
        style={{ marginTop: spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  vehicleNumber: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  statusLine: { marginTop: spacing.sm, fontSize: font.small, fontWeight: font.medium, lineHeight: 20 },
  docCard: { marginBottom: spacing.sm },
  docPick: { marginBottom: spacing.sm },
  docLabel: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
});
