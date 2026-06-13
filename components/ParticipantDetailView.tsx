import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme, Colors } from "../lib/theme";
import { Profile, Review } from "../lib/types";
import AvatarWithFrame from "./AvatarWithFrame";

type Props = {
  profile: Profile;
  reviews: Review[];
  stats: { joined: number; created: number; abandoned: number } | null;
  friendStatus: "none" | "pending" | "friends";
  currentUserId: string | null;
  participantRatings: Record<string, string>;
  onSendFriendRequest: () => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export default function ParticipantDetailView({ profile, reviews, stats, friendStatus, currentUserId, participantRatings, onSendFriendRequest, contentContainerStyle }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <ScrollView contentContainerStyle={contentContainerStyle}>
      <View style={styles.profileHeader}>
        <AvatarWithFrame
          avatarUrl={profile.avatar_url}
          initial={profile.username}
          equippedBorderId={profile.equipped_border_id}
          size="large"
          style={{ marginBottom: 12 }}
        />
        <Text style={styles.username}>{profile.username}</Text>
        <Text style={styles.rating}>★ {participantRatings[profile.id] ?? "—/4"}</Text>
        {profile.id !== currentUserId && (
          friendStatus === "friends" ? (
            <View style={styles.friendBadge}>
              <Text style={styles.friendBadgeText}>✓ Friends</Text>
            </View>
          ) : friendStatus === "pending" ? (
            <View style={[styles.friendBadge, styles.friendBadgePending]}>
              <Text style={styles.friendBadgeText}>Request Sent</Text>
            </View>
          ) : (
            <Pressable style={styles.addFriendBtn} onPress={onSendFriendRequest}>
              <Text style={styles.addFriendBtnText}>+ Add Friend</Text>
            </Pressable>
          )
        )}
        {profile.recently_abandoned_at && (
          <View style={styles.abandonedBadge}>
            <Text style={styles.abandonedBadgeText}>Recently Abandoned</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats?.joined ?? "—"}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats?.created ?? "—"}</Text>
          <Text style={styles.statLabel}>Created</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, (stats?.abandoned ?? 0) > 0 && styles.statNumAbandoned]}>
            {stats?.abandoned ?? "—"}
          </Text>
          <Text style={styles.statLabel}>Abandoned</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Sports Interests</Text>
      <View style={styles.sportsRow}>
        {profile.sports_interests.length > 0 ? (
          profile.sports_interests.map((s) => (
            <View key={s} style={styles.sportChip}>
              <Text style={styles.sportChipText}>{s}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noSportsText}>No sports interests listed.</Text>
        )}
      </View>

      <Text style={styles.sectionLabel}>Reviews ({reviews.length})</Text>
      {reviews.length === 0 ? (
        <Text style={styles.emptyText}>No reviews yet.</Text>
      ) : (
        reviews.map((r) => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewerName}>{r.reviewer_name}</Text>
              <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.reviewComment}>{r.comment}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function makeStyles(c: Colors, isDark: boolean) {
  return StyleSheet.create({
    profileHeader: { alignItems: "center", marginBottom: 24 },
    username: { fontSize: 20, fontWeight: "700", color: c.text, marginBottom: 4 },
    rating: { fontSize: 14, fontWeight: "600", color: "#f59e0b", marginBottom: 10 },
    friendBadge: { marginTop: 8, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: "#e8f5e9", borderRadius: 20 },
    friendBadgePending: { backgroundColor: isDark ? "#2a2a2a" : "#f5f5f5" },
    friendBadgeText: { color: "#4CAF50", fontWeight: "600", fontSize: 13 },
    addFriendBtn: { marginTop: 8, marginBottom: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: "#4CAF50", borderRadius: 20 },
    addFriendBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    abandonedBadge: { backgroundColor: "#fff3e0", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#ff9800" },
    abandonedBadgeText: { fontSize: 10, color: "#e65100", fontWeight: "700" },
    statsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: c.borderLight, borderRadius: 12, paddingVertical: 14, marginBottom: 20, marginTop: 4 },
    statItem: { flex: 1, alignItems: "center" },
    statNum: { fontSize: 20, fontWeight: "700", color: c.text },
    statNumAbandoned: { color: "#e65100" },
    statLabel: { fontSize: 11, color: c.textFaint, marginTop: 2 },
    statDivider: { width: 1, height: 32, backgroundColor: c.border },
    sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase", color: c.placeholder, marginBottom: 12, marginTop: 20 },
    sportsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    sportChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#212121", borderWidth: 1, borderColor: "#212121" },
    sportChipText: { color: "#fff", fontWeight: "600", fontSize: 13 },
    noSportsText: { fontSize: 13, color: c.textFaint, fontStyle: "italic" },
    emptyText: { fontSize: 14, color: c.placeholder, textAlign: "center", lineHeight: 22 },
    reviewCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 },
    reviewRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    reviewerName: { fontSize: 13, fontWeight: "600", color: c.text },
    reviewDate: { fontSize: 11, color: c.textFaint },
    reviewComment: { fontSize: 13, color: c.textSub, lineHeight: 20 },
  });
}
