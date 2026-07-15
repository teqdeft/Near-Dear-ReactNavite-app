import React, { useState, useCallback, useRef } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NotificationApi } from '../../api';
import { useAuth } from '../../store/AuthContext';
import { useNotifications } from '../../store/NotificationContext';
import { Muted, Row, EmptyState, Loader, IconBadge } from '../../components/UI';
import Icon from '../../components/Icon';
import { timeAgo } from '../../utils/datetime';
import { notificationTarget } from '../../utils/notificationTarget';
import { colors, spacing, font, radius } from '../../theme';

const TYPE_ICON = {
  blood: { icon: 'blood', color: colors.blood },
  blood_accepted: { icon: 'blood', color: colors.blood },
  medicine_order: { icon: 'pharmacy', color: colors.pharmacy },
  ambulance: { icon: 'ambulance', color: colors.ambulance },
  admin: { icon: 'bell', color: colors.primary },
  support: { icon: 'support', color: colors.info },
};

const BUTTON_WIDTH = 80;
const OPEN_THRESHOLD = 45;             // small drag is enough to open (high sensitivity)
const FLICK_VELOCITY = 0.3;            // a quick left flick opens even on a short drag
// Native driver so the snap runs on the UI thread — smooth even if JS is busy.
const SPRING = { useNativeDriver: true, friction: 11, tension: 80 };

const NotificationItem = ({
  item, onPress, onDelete, onMarkRead, isUnread, closeOthers, setOpenRow, clearOpenRow,
}) => {
  const panX = useRef(new Animated.Value(0)).current;
  // Resting offset the current drag is measured from: 0 closed, -openWidth open.
  const restX = useRef(0);

  // A read notification only offers Delete; an unread one offers Read + Delete,
  // so it opens twice as wide.
  const openWidth = (isUnread ? 2 : 1) * BUTTON_WIDTH;

  // Fade the action buttons in as the row slides — invisible when closed, full
  // opacity only once the notification is fully swiped across.
  const actionsOpacity = panX.interpolate({
    inputRange: [-openWidth, -openWidth * 0.15, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  const openRow = () => {
    restX.current = -openWidth;
    Animated.spring(panX, { ...SPRING, toValue: -openWidth }).start();
    setOpenRow(item.id, closeRow);
  };
  const closeRow = () => {
    restX.current = 0;
    Animated.spring(panX, { ...SPRING, toValue: 0 }).start();
    clearOpenRow(item.id);
  };

  // The PanResponder is created once; read the latest callbacks through this ref
  // so it never acts on a stale closure.
  const latest = useRef({});
  latest.current = { openRow, closeRow, closeOthers, id: item.id, openWidth };

  const panResponder = useRef(
    PanResponder.create({
      // Don't grab the touch on start — let taps and the vertical list scroll
      // through. Only take over once the drag is clearly horizontal.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6,
      onPanResponderGrant: () => {
        // Starting to swipe THIS row closes any other open row.
        latest.current.closeOthers(latest.current.id);
      },
      onPanResponderMove: (_, g) => {
        let next = restX.current + g.dx;
        if (next > 0) next = 0;
        if (next < -latest.current.openWidth) next = -latest.current.openWidth;
        panX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const next = restX.current + g.dx;
        const flick = g.vx < -FLICK_VELOCITY;
        if (next < 0 && (next < -OPEN_THRESHOLD || flick)) latest.current.openRow();
        else latest.current.closeRow();
      },
      onPanResponderTerminate: () => latest.current.closeRow(),
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const handleDelete = async () => {
    closeRow();
    await onDelete(item.id);
  };

  const handleMarkRead = async () => {
    closeRow();
    await onMarkRead(item.id);
  };

  const t = TYPE_ICON[item.type] || { icon: 'bell', color: colors.primary };

  return (
    <View style={styles.itemContainer}>
      {/* Action buttons revealed behind the row, fading in with the slide */}
      <Animated.View style={[styles.hiddenActions, { opacity: actionsOpacity }]}>
        {isUnread ? (
          <TouchableOpacity onPress={handleMarkRead} style={styles.actionButton} activeOpacity={0.8}>
            <View style={[styles.actionCircle, { backgroundColor: colors.success }]}>
              <Icon name="check" size={20} color="#fff" />
            </View>
            <Text style={styles.actionText}>Read</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={handleDelete} style={styles.actionButton} activeOpacity={0.8}>
          <View style={[styles.actionCircle, { backgroundColor: colors.danger }]}>
            <Icon name="trash" size={20} color="#fff" />
          </View>
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Swipeable notification content */}
      <Animated.View
        style={[styles.itemContent, { transform: [{ translateX: panX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            // If this row is open, a tap just closes it instead of navigating.
            if (restX.current !== 0) { closeRow(); return; }
            onPress(item);
          }}
          style={[styles.item, isUnread && styles.unread]}
        >
          <IconBadge
            name={t.icon}
            color={t.color}
            size={40}
            iconSize={20}
            style={{ marginRight: spacing.md }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Muted style={{ marginTop: 2 }}>{item.message}</Muted>
            {item.created_at ? (
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            ) : null}
          </View>
          {isUnread ? <View style={styles.dot} /> : null}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default function NotificationsScreen({ navigation }) {
  const { isDriver, user, donor } = useAuth();
  const isDonor = !!donor || user?.role === 'donor';
  const isPharmacyOwner = user?.role === 'pharmacy_owner';
  const { setUnread } = useNotifications();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // The one row currently swiped open: { id, close }. Only one stays open at a time.
  const openRowRef = useRef(null);
  const closeOthers = useCallback((id) => {
    if (openRowRef.current && openRowRef.current.id !== id) {
      openRowRef.current.close();
      openRowRef.current = null;
    }
  }, []);
  const setOpenRow = useCallback((id, close) => {
    if (openRowRef.current && openRowRef.current.id !== id) openRowRef.current.close();
    openRowRef.current = { id, close };
  }, []);
  const clearOpenRow = useCallback((id) => {
    if (openRowRef.current && openRowRef.current.id === id) openRowRef.current = null;
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await NotificationApi.list();
      setData(res);
      setUnread(Number(res?.unread || 0));
    } catch (e) {
      setData({ items: [], unread: 0 });
    }
  }, [setUnread]);

  // Reload on focus; on leaving the screen, snap any open row shut.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (openRowRef.current) { openRowRef.current.close(); openRowRef.current = null; }
      };
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markAll = async () => {
    try {
      await NotificationApi.markAllRead();
      await load();
    } catch (e) {}
  };

  const tap = (item) => {
    if (!item.is_read) {
      NotificationApi.markRead(item.id).then(load).catch(() => {});
    }
    const target = notificationTarget(item, { isDriver, isDonor, isPharmacyOwner });
    if (target) navigation.navigate(target.screen, target.params);
  };

  const handleDelete = async (notificationId) => {
    try { await NotificationApi.remove(notificationId); } catch (e) {}
    await load();
  };

  const handleMarkRead = async (notificationId) => {
    try { await NotificationApi.markRead(notificationId); } catch (e) {}
    await load();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Row style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {data?.unread > 0 ? (
          <TouchableOpacity onPress={markAll}>
            <Text style={styles.link}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </Row>
      {data === null ? (
        <Loader />
      ) : (
        <FlatList
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: 120,
            flexGrow: 1,
          }}
          data={data.items}
          keyExtractor={(i) => String(i.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title="You're all caught up"
              subtitle="Alerts about blood, orders and ambulance appear here."
            />
          }
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              onPress={tap}
              onDelete={handleDelete}
              onMarkRead={handleMarkRead}
              isUnread={!item.is_read}
              closeOthers={closeOthers}
              setOpenRow={setOpenRow}
              clearOpenRow={clearOpenRow}
            />
          )}
          scrollEnabled={true}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  link: { color: colors.primary, fontWeight: font.semibold },
  itemContainer: {
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  itemContent: {
    zIndex: 2,
  },
  hiddenActions: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  actionButton: {
    width: BUTTON_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  actionText: {
    color: colors.textMuted,
    fontSize: font.tiny,
    fontWeight: font.semibold,
    marginTop: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  unread: { backgroundColor: '#EAF7F5' },
  itemTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  time: { fontSize: font.tiny, color: colors.textMuted, marginTop: 6 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    marginTop: 4,
  },
});
