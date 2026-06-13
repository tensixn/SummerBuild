import { useMemo } from "react";
import { Modal, View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, Colors } from "../lib/theme";
import { Notification } from "../lib/types";
import CloseButton from "./CloseButton";

type Props = {
  visible: boolean;
  allNotifications: Notification[];
  refreshing: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onAcceptFriend: (n: Notification) => void;
  onDeclineFriend: (n: Notification) => void;
  onMarkAllRead: () => void;
  onViewGameById: (gameId: string) => void;
};

const SPORT_NAMES = ["Basketball", "Football", "Badminton", "Volleyball", "Frisbee"];

function parseBoldParts(text: string): { t: string; bold: boolean }[] {
  const boldRanges: { start: number; end: number }[] = [];

  // Sport names
  const sportRx = new RegExp(`\\b(${SPORT_NAMES.join("|")})\\b`, "g");
  let m: RegExpExecArray | null;
  while ((m = sportRx.exec(text)) !== null)
    boldRanges.push({ start: m.index, end: m.index + m[0].length });

  // Location after "at " — lazy match until stop word or punctuation
  const locRx = /\bat ([\w\s]+?)(?=\s+(?:was|game|has|is)|[!.?]|$)/g;
  while ((m = locRx.exec(text)) !== null)
    boldRanges.push({ start: m.index + 3, end: m.index + 3 + m[1].length });

  boldRanges.sort((a, b) => a.start - b.start);

  const parts: { t: string; bold: boolean }[] = [];
  let pos = 0;
  for (const r of boldRanges) {
    if (r.start > pos) parts.push({ t: text.slice(pos, r.start), bold: false });
    if (r.start >= pos) {
      parts.push({ t: text.slice(r.start, r.end), bold: true });
      pos = r.end;
    }
  }
  if (pos < text.length) parts.push({ t: text.slice(pos), bold: false });
  return parts;
}

type IconConfig = { name: React.ComponentProps<typeof Ionicons>["name"]; color: string };

function notifIconConfig(message: string): IconConfig {
  const m = message.toLowerCase();
  if (m.includes("removed") || m.includes("deleted"))
    return { name: "close-circle-outline", color: "#EF4444" };
  if (m.includes("ended"))
    return { name: "time-outline", color: "#F59E0B" };
  if (m.includes("friend request") || m.includes("accepted"))
    return { name: "person-add-outline", color: "#22C55E" };
  return { name: "notifications-outline", color: "#6B7280" };
}

function normalizeMessage(n: Notification): string {
  if (n.type === "game_cancelled" || n.type === "game_removed") {
    const sport = SPORT_NAMES.find((s) => n.message.includes(s));
    const locMatch = n.message.match(/\bat\s+([\w\s,]+?)(?=\s+(?:was|has|is|game)|[!.?]|$)/);
    const location = locMatch?.[1]?.trim();
    if (sport && location) return `${sport} at ${location} was deleted by the host`;
  }
  if (n.type === "friend_accepted") {
    const match = n.message.match(/^(.+?)\s+accepted\b/i);
    if (match) return `${match[1]} accepted your friend request`;
  }
  return n.message;
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-SG", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MailboxModal({ visible, allNotifications, refreshing, onClose, onRefresh, onAcceptFriend, onDeclineFriend, onMarkAllRead, onViewGameById }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          <CloseButton onPress={onClose} />
        </View>
        <FlatList
          data={allNotifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.content}
          ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet.</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item: n }) => {
            const { name, color } = notifIconConfig(n.message);
            const parts = parseBoldParts(normalizeMessage(n));
            return (
              <View style={[styles.item, n.is_read && styles.itemRead, n.type === "game_ended" && !n.is_read && styles.itemRating]}>
                <View style={styles.itemRow}>
                  <Ionicons name={name} size={20} color={color} style={styles.icon} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.message, n.is_read && styles.messageRead]}>
                      {parts.map((p, i) =>
                        p.bold
                          ? <Text key={i} style={styles.messageBold}>{p.t}</Text>
                          : p.t
                      )}
                    </Text>
                    <Text style={styles.time}>{formatDate(n.created_at)}</Text>
                    {n.type === "friend_request" && !n.is_read && (
                      <View style={styles.friendReqBtns}>
                        <Pressable style={styles.acceptBtn} onPress={() => onAcceptFriend(n)}>
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </Pressable>
                        <Pressable style={styles.declineBtn} onPress={() => onDeclineFriend(n)}>
                          <Text style={styles.declineBtnText}>Decline</Text>
                        </Pressable>
                      </View>
                    )}
                    {n.type === "game_invite" && n.related_game_id && (
                      <Pressable style={styles.viewGameBtn} onPress={() => onViewGameById(n.related_game_id!)}>
                        <Text style={styles.viewGameBtnText}>View Game →</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
        {allNotifications.some((n) => !n.is_read) && (
          <View style={styles.footer}>
            <Pressable style={styles.markAllReadBtn} onPress={onMarkAllRead}>
              <Text style={styles.markAllReadText}>Mark all as read</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(c: Colors, isDark: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: c.borderLight },
    title: { fontSize: 17, fontWeight: "700", color: c.text, flex: 1, marginRight: 8 },
    content: { padding: 20, paddingBottom: 48 },
    emptyText: { fontSize: 14, color: c.placeholder, textAlign: "center", lineHeight: 22 },
    item: { backgroundColor: isDark ? "rgba(255,152,0,0.12)" : "#fff3e0", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: isDark ? "rgba(255,152,0,0.25)" : "#ffe0b2" },
    itemRead: { backgroundColor: c.bg, borderColor: c.border },
    itemRating: { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#fffbeb", borderColor: isDark ? "rgba(245,158,11,0.28)" : "#fde68a" },
    itemRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    icon: { marginTop: 1 },
    message: { fontSize: 13, color: c.text, lineHeight: 20, marginBottom: 4 },
    messageBold: { fontWeight: "700", color: c.text },
    messageRead: { color: c.textFaint },
    time: { fontSize: 11, color: c.textFaint },
    friendReqBtns: { flexDirection: "row", gap: 8, marginTop: 10 },
    acceptBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
    acceptBtnText: { color: c.primaryText, fontWeight: "600", fontSize: 13 },
    declineBtn: { flex: 1, backgroundColor: c.surface, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: c.border },
    declineBtnText: { color: c.textMuted, fontWeight: "600", fontSize: 13 },
    viewGameBtn: { marginTop: 8, alignSelf: "flex-start", backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    viewGameBtnText: { fontSize: 13, fontWeight: "600", color: "#22c55e" },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: c.borderLight },
    markAllReadBtn: { backgroundColor: c.primary, borderRadius: 10, padding: 14, alignItems: "center" },
    markAllReadText: { color: c.primaryText, fontWeight: "600", fontSize: 14 },
  });
}
