import { useMemo } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, Colors } from "../lib/theme";
import { Notification } from "../lib/types";

type Props = {
  visible: boolean;
  notifications: Notification[];
  onDismiss: () => void;
  onAcceptFriend: (n: Notification) => void;
  onDeclineFriend: (n: Notification) => void;
};

export default function NotificationModal({ visible, notifications, onDismiss, onAcceptFriend, onDeclineFriend }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.titleRow}>
            <Ionicons name="notifications" size={18} color={colors.text} />
            <Text style={styles.title}>New Notifications</Text>
          </View>
          {notifications.map((n) => (
            <View key={n.id} style={[styles.item, n.type === "game_ended" && styles.itemRating]}>
              {n.type === "game_ended" && (
                <View style={styles.typeIconRow}>
                  <Ionicons name="star" size={12} color="#f59e0b" />
                  <Text style={styles.typeIcon}>Time to Rate</Text>
                </View>
              )}
              <Text style={styles.message}>{n.message}</Text>
              <Text style={styles.time}>{new Date(n.created_at).toLocaleDateString()}</Text>
              {n.type === "friend_request" && (
                <View style={styles.friendReqBtns}>
                  <Pressable style={styles.acceptBtn} onPress={() => onAcceptFriend(n)}>
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </Pressable>
                  <Pressable style={styles.declineBtn} onPress={() => onDeclineFriend(n)}>
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
          <Pressable style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissText}>Dismiss all</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors, isDark: boolean) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
    modal: { backgroundColor: c.surface, borderRadius: 16, padding: 24, width: "100%" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    title: { fontSize: 18, fontWeight: "700", color: c.text },
    typeIconRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
    item: { backgroundColor: isDark ? "rgba(255,152,0,0.12)" : "#fff3e0", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: isDark ? "rgba(255,152,0,0.25)" : "#ffe0b2" },
    itemRating: { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#fffbeb", borderColor: isDark ? "rgba(245,158,11,0.28)" : "#fde68a" },
    typeIcon: { fontSize: 12, fontWeight: "700", color: "#f59e0b" },
    message: { fontSize: 13, color: c.text, lineHeight: 20, marginBottom: 4 },
    time: { fontSize: 11, color: c.textFaint },
    friendReqBtns: { flexDirection: "row", gap: 8, marginTop: 10 },
    acceptBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
    acceptBtnText: { color: c.primaryText, fontWeight: "600", fontSize: 13 },
    declineBtn: { flex: 1, backgroundColor: c.surface, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: c.border },
    declineBtnText: { color: c.textMuted, fontWeight: "600", fontSize: 13 },
    dismissBtn: { backgroundColor: c.primary, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
    dismissText: { color: c.primaryText, fontWeight: "600", fontSize: 14 },
  });
}
