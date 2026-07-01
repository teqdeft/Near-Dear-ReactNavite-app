import React, { useState, useCallback } from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NotificationApi } from '../../api';
import { Muted, Row, EmptyState, Loader, IconBadge } from '../../components/UI';
import Icon from '../../components/Icon';
import { colors, spacing, font, radius } from '../../theme';

const TYPE_ICON = {
  blood: { icon: 'blood', color: colors.blood },
  medicine_order: { icon: 'pharmacy', color: colors.pharmacy },
  ambulance: { icon: 'ambulance', color: colors.ambulance },
  admin: { icon: 'bell', color: colors.primary },
  support: { icon: 'support', color: colors.info },
};

export default function NotificationsScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await NotificationApi.list()); } catch (e) { setData({ items: [], unread: 0 }); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markAll = async () => { try { await NotificationApi.markAllRead(); await load(); } catch (e) {} };
  const tap = async (item) => { if (!item.is_read) { try { await NotificationApi.markRead(item.id); load(); } catch (e) {} } };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Row style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {data?.unread > 0 ? (
          <TouchableOpacity onPress={markAll}><Text style={styles.link}>Mark all read</Text></TouchableOpacity>
        ) : null}
      </Row>
      {data === null ? <Loader /> : (
        <FlatList
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, flexGrow: 1 }}
          data={data.items}
          keyExtractor={(i) => String(i.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="bell" title="You're all caught up" subtitle="Alerts about blood, orders and ambulance appear here." />}
          renderItem={({ item }) => {
            const t = TYPE_ICON[item.type] || { icon: 'bell', color: colors.primary };
            return (
              <TouchableOpacity activeOpacity={0.8} onPress={() => tap(item)}
                style={[styles.item, !item.is_read && styles.unread]}>
                <IconBadge name={t.icon} color={t.color} size={40} iconSize={20} style={{ marginRight: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Muted style={{ marginTop: 2 }}>{item.message}</Muted>
                </View>
                {!item.is_read ? <View style={styles.dot} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  link: { color: colors.primary, fontWeight: font.semibold },
  item: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  unread: { backgroundColor: '#EAF7F5' },
  itemTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginLeft: spacing.sm, marginTop: 4 },
});
