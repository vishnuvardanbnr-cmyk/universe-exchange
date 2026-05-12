import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useNotifications, NotifType, AppNotification } from "@/context/NotificationsContext";

const TYPE_FILTERS: Array<NotifType | "all"> = ["all", "trade", "price", "staking", "system", "security", "promo"];

const TYPE_META: Record<NotifType, { icon: string; color: string; label: string; description: string }> = {
  trade:    { icon: "trending-up", color: "#00C087", label: "Trades",   description: "Trade executions and order fills" },
  price:    { icon: "bar-chart-2", color: "#F0B90B", label: "Price",    description: "Price alerts and market movements" },
  staking:  { icon: "percent",     color: "#9945FF", label: "Staking",  description: "Staking rewards and updates" },
  system:   { icon: "info",        color: "#628EEA", label: "System",   description: "Account and platform updates" },
  security: { icon: "shield",      color: "#FF4B4B", label: "Security", description: "Security alerts and login activity" },
  promo:    { icon: "gift",        color: "#F7931A", label: "Promos",   description: "Promotions and new features" },
};

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Detail Modal ────────────────────────────────────────────────────────────
function NotifDetailModal({
  notif,
  onClose,
  onDelete,
}: {
  notif: AppNotification | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!notif) return null;

  const meta = TYPE_META[notif.type];
  const iconName = (notif.icon ?? meta.icon) as any;

  const handleShare = async () => {
    try {
      await Share.share({ message: `${notif.title}\n\n${notif.body}` });
    } catch {}
  };

  const handleDelete = () => {
    Alert.alert("Delete Notification", "Remove this notification?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { onDelete(); onClose(); } },
    ]);
  };

  return (
    <Modal visible={!!notif} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>

        {/* Header bar */}
        <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}
          >
            <Feather name="x" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[detailStyles.headerTitle, { color: colors.foreground }]}>Notification</Text>
          <TouchableOpacity
            onPress={handleShare}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}
          >
            <Feather name="share" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>

          {/* Icon + category hero */}
          <View style={{ alignItems: "center", gap: 16, paddingVertical: 8 }}>
            <View style={[detailStyles.heroIcon, { backgroundColor: meta.color + "18" }]}>
              <Feather name={iconName} size={36} color={meta.color} />
            </View>
            <View style={{ alignItems: "center", gap: 6 }}>
              <View style={[detailStyles.typePill, { backgroundColor: meta.color + "18" }]}>
                <Feather name={meta.icon as any} size={11} color={meta.color} />
                <Text style={[detailStyles.typePillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
                {meta.description}
              </Text>
            </View>
          </View>

          {/* Title + body card */}
          <View style={[detailStyles.contentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[detailStyles.notifTitle, { color: colors.foreground }]}>{notif.title}</Text>
            <View style={[detailStyles.divider, { backgroundColor: colors.border }]} />
            <Text style={[detailStyles.notifBody, { color: colors.mutedForeground }]}>{notif.body}</Text>
          </View>

          {/* Metadata grid */}
          <View style={[detailStyles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={detailStyles.metaRow}>
              <View style={detailStyles.metaItem}>
                <Text style={[detailStyles.metaLabel, { color: colors.mutedForeground }]}>RECEIVED</Text>
                <Text style={[detailStyles.metaValue, { color: colors.foreground }]}>{timeAgo(notif.timestamp)}</Text>
              </View>
              <View style={[detailStyles.metaDivider, { backgroundColor: colors.border }]} />
              <View style={detailStyles.metaItem}>
                <Text style={[detailStyles.metaLabel, { color: colors.mutedForeground }]}>STATUS</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: notif.read ? colors.mutedForeground : colors.primary }} />
                  <Text style={[detailStyles.metaValue, { color: notif.read ? colors.mutedForeground : colors.primary }]}>
                    {notif.read ? "Read" : "Unread"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[detailStyles.divider, { backgroundColor: colors.border }]} />
            <View style={detailStyles.metaItem}>
              <Text style={[detailStyles.metaLabel, { color: colors.mutedForeground }]}>DATE & TIME</Text>
              <Text style={[detailStyles.metaValue, { color: colors.foreground }]}>{formatFullDate(notif.timestamp)}</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.8}
              style={[detailStyles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              <Feather name="share-2" size={16} color={colors.foreground} />
              <Text style={[detailStyles.actionBtnText, { color: colors.foreground }]}>Share Notification</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              activeOpacity={0.8}
              style={[detailStyles.actionBtn, { backgroundColor: "#FF4B4B12", borderColor: "#FF4B4B30" }]}
            >
              <Feather name="trash-2" size={16} color="#FF4B4B" />
              <Text style={[detailStyles.actionBtnText, { color: "#FF4B4B" }]}>Delete Notification</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Notification Card ───────────────────────────────────────────────────────
function NotifCard({
  notif,
  onPress,
  onDelete,
}: {
  notif: AppNotification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const meta = TYPE_META[notif.type];
  const iconName = (notif.icon ?? meta.icon) as any;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: notif.read ? colors.border : colors.primary + "44" }]}>
      {!notif.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
      <TouchableOpacity
        style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 }}
        onPress={() => { onPress(); Haptics.selectionAsync(); }}
        activeOpacity={0.8}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.color + "18" }]}>
          <Feather name={iconName} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: notif.read ? "Inter_500Medium" : "Inter_700Bold" }]} numberOfLines={1}>
              {notif.title}
            </Text>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{timeAgo(notif.timestamp)}</Text>
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]} numberOfLines={2}>{notif.body}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={[styles.typeBadge, { backgroundColor: meta.color + "18" }]}>
              <Text style={[styles.typeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Tap to view</Text>
              <Feather name="chevron-right" size={10} color={colors.mutedForeground} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { onDelete(); Haptics.selectionAsync(); }}
        style={styles.deleteBtn}
        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
      >
        <Feather name="x" size={15} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification, clearAll } = useNotifications();
  const [filter, setFilter] = useState<NotifType | "all">("all");
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = filter === "all" ? notifications : notifications.filter((n) => n.type === filter);
  const groupedDates = filtered.reduce<Record<string, AppNotification[]>>((acc, n) => {
    const d = new Date(n.timestamp);
    const now = new Date();
    let key: string;
    if (d.toDateString() === now.toDateString()) key = "Today";
    else if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) key = "Yesterday";
    else key = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  const openDetail = (n: AppNotification) => {
    setSelected(n);
    markRead(n.id);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Notifications {unreadCount > 0 && <Text style={[styles.badge, { color: colors.primary }]}>({unreadCount})</Text>}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {unreadCount > 0 && (
            <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.secondary }]} onPress={() => { markAllRead(); Haptics.selectionAsync(); }}>
              <Text style={[styles.headerBtnText, { color: colors.primary }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.secondary }]}
            onPress={() => Alert.alert("Clear all?", "This will delete all notifications.", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", style: "destructive", onPress: clearAll },
            ])}
          >
            <Feather name="trash-2" size={14} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {TYPE_FILTERS.map((f) => {
            const count = f === "all"
              ? notifications.filter((n) => !n.read).length
              : notifications.filter((n) => n.type === f && !n.read).length;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterChip, { backgroundColor: filter === f ? colors.primary : colors.secondary, borderColor: filter === f ? colors.primary : colors.border }]}
              >
                <Text style={[styles.filterText, { color: filter === f ? colors.primaryForeground : colors.mutedForeground }]}>
                  {f === "all" ? "All" : TYPE_META[f as NotifType].label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, { backgroundColor: filter === f ? "#ffffff55" : colors.primary }]}>
                    <Text style={styles.filterBadgeText}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
            <Feather name="bell-off" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>No notifications</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>You're all caught up!</Text>
          </View>
        )}
        {Object.entries(groupedDates).map(([date, notifs]) => (
          <View key={date}>
            <Text style={[styles.dateGroup, { color: colors.mutedForeground }]}>{date}</Text>
            {notifs.map((n) => (
              <NotifCard
                key={n.id}
                notif={n}
                onPress={() => openDetail(n)}
                onDelete={() => deleteNotification(n.id)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <NotifDetailModal
        notif={selected}
        onClose={() => setSelected(null)}
        onDelete={() => selected && deleteNotification(selected.id)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  badge: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  headerBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterRow: { height: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center", flexDirection: "row" },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, height: 32, flexShrink: 0 },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  dateGroup: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginTop: 4, marginBottom: 6 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, position: "relative" },
  unreadDot: { position: "absolute", top: 14, left: 6, width: 6, height: 6, borderRadius: 3 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle: { fontSize: 13, flex: 1, marginRight: 4 },
  timeText: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },
  cardBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  typeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { padding: 8, marginLeft: 4, alignSelf: "flex-start" },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular" },
});

const detailStyles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  heroIcon: {
    width: 88, height: 88, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
  },
  typePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  typePillText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  contentCard: {
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden",
    padding: 18, gap: 14,
  },
  notifTitle: { fontSize: 20, fontFamily: "Inter_700Bold", lineHeight: 26 },
  notifBody: { fontSize: 15, fontFamily: "Inter_500Medium", lineHeight: 23 },
  divider: { height: StyleSheet.hairlineWidth },
  metaCard: {
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden",
    padding: 16, gap: 14,
  },
  metaRow: { flexDirection: "row", gap: 0 },
  metaItem: { flex: 1, gap: 5 },
  metaDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 16, alignSelf: "stretch" },
  metaLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  metaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, height: 52, borderRadius: 14, borderWidth: 1,
  },
  actionBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
