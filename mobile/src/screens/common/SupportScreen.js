import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SupportApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Card, Pill, Muted, Row, AppButton, TextField, SectionTitle, Chip } from '../../components/UI';
import { formatDateTime } from '../../utils/datetime';
import { colors, spacing, font } from '../../theme';

const TOPICS = [
  { key: 'general', label: 'General' },
  { key: 'blood_request', label: 'Blood' },
  { key: 'ambulance', label: 'Ambulance' },
  { key: 'medicine_order', label: 'Medicine' },
  { key: 'pharmacy', label: 'Pharmacy' },
];
const STATUS_COLOR = { open: colors.info, in_progress: colors.warning, resolved: colors.success, closed: colors.textMuted };

export default function SupportScreen() {
  const { isDriver } = useAuth();
  const accent = isDriver ? colors.ambulance : colors.primary;
  const [topic, setTopic] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);

  const load = useCallback(async () => {
    try { setTickets((await SupportApi.mine()) || []); } catch (e) { /* ignore */ }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return Alert.alert('Support', 'Please enter a subject and message.');
    setLoading(true);
    try {
      await SupportApi.create({ related_type: topic, subject: subject.trim(), message: message.trim() });
      setSubject(''); setMessage('');
      Alert.alert('Sent ✅', 'Your support ticket has been created.');
      await load();
    } catch (e) { Alert.alert('Error', errMessage(e)); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <SectionTitle>Raise a ticket</SectionTitle>
      <Text style={styles.label}>Topic</Text>
      <View style={styles.chips}>
        {TOPICS.map((t) => <Chip key={t.key} label={t.label} active={topic === t.key} color={accent} onPress={() => setTopic(t.key)} />)}
      </View>
      <TextField label="Subject" value={subject} onChangeText={setSubject} placeholder="Brief subject" />
      <TextField label="Message" value={message} onChangeText={setMessage} placeholder="Describe your issue" multiline style={{ height: 110 }} />
      <AppButton title="Submit ticket" color={accent} onPress={submit} loading={loading} />

      <SectionTitle style={{ marginTop: spacing.xl }}>My tickets</SectionTitle>
      {tickets.length === 0 ? (
        <Muted>No tickets yet.</Muted>
      ) : tickets.map((t) => (
        <Card key={t.id} style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.subject}>{t.subject}</Text>
            <Pill label={t.status.replace('_', ' ')} color={STATUS_COLOR[t.status] || colors.textMuted} />
          </Row>
          <Muted style={{ marginTop: 4 }}>{t.message}</Muted>
          {t.created_at ? <Muted style={{ marginTop: 4 }}>Raised: {formatDateTime(t.created_at)}</Muted> : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  card: { marginBottom: spacing.md },
  subject: { fontSize: font.body, fontWeight: font.semibold, color: colors.text, flex: 1 },
});
