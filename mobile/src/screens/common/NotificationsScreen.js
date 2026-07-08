import React, { useState, useCallback } from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NotificationApi } from '../../api';
import { useAuth } from '../../store/AuthContext';
import { useNotifications } from '../../store/NotificationContext';
import { Muted, Row, EmptyState, Loader, IconBadge } from '../../components/UI';
import Icon from '../../components/Icon';
import { timeAgo } from '../../utils/datetime';
import { colors, spacing, font, radius } from '../../theme';

const TYPE_ICON = {
  blood: { icon: 'blood', color: colors.blood },
  medicine_order: { icon: 'pharmacy', color: colors.pharmacy },
  ambulance: { icon: 'ambulance', color: colors.ambulance },
  admin: { icon: 'bell', color: colors.primary },
  support: { icon: 'support', color: colors.info },
};

// Where a notification should take the user when tapped. reference_id points to
// the related entity (order / request id). Returns null when there is no
// meaningful detail screen (e.g. generic admin alerts) or the target screen
// isn't part of the current user's navigator.
function notificationTarget(item, { isDriver, isDonor }) {
  const id = item.reference_id;
  if (isDriver) {
    // The driver stack only registers the driver tabs + Support.
    if (item.type === 'ambulance') return { screen: 'DriverTrips' };
    if (item.type === 'support') return { screen: 'Support' };
    return null;
  }
  switch (item.type) {
    case 'medicine_order': return id ? { screen: 'OrderDetail', params: { id } } : null;
    case 'ambulance': return id ? { screen: 'AmbulanceDetail', params: { id } } : null;
    case 'blood':
      // Donors act on nearby requests from the "Requests for me" list (accept /
      // decline). The requester's contact stays hidden there until the donor
      // accepts. Requesters instead track their own request in its detail page.
      if (isDonor) return { screen: 'DonorRequests' };
      return id ? { screen: 'BloodRequestDetail', params: { id } } : null;
    case 'support': return { screen: 'Support' };
    default: return null;
  }
}

export default function NotificationsScreen({ navigation }) {
  const { isDriver, user, donor } = useAuth();
  const isDonor = !!donor || user?.role === 'donor';
  const { setUnread } = useNotifications();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await NotificationApi.list();
      setData(res);
      // Keep the tab-bar badge in sync with what we just loaded/read here.
      setUnread(Number(res?.unread || 0));
    } catch (e) { setData({ items: [], unread: 0 }); }
  }, [setUnread]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markAll = async () => { try { await NotificationApi.markAllRead(); await load(); } catch (e) {} };
  const tap = (item) => {
    // Mark read in the background so navigation feels instant.
    if (!item.is_read) { NotificationApi.markRead(item.id).then(load).catch(() => {}); }
    const target = notificationTarget(item, { isDriver, isDonor });
    if (target) navigation.navigate(target.screen, target.params);
  };

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
                  {item.created_at ? <Text style={styles.time}>{timeAgo(item.created_at)}</Text> : null}
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
  time: { fontSize: font.tiny, color: colors.textMuted, marginTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginLeft: spacing.sm, marginTop: 4 },
});
