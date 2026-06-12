import { useMemo } from "react";
import { Modal, View, Text, Pressable, ScrollView, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, Colors } from "../lib/theme";
import { Game, Profile } from "../lib/types";
import CloseButton from "./CloseButton";
import AvatarWithFrame from "./AvatarWithFrame";

type Props = {
  visible: boolean;
  rateGame: Game | null;
  rateParticipants: Profile[];
  ratingSelections: Record<string, number>;
  reviewSelections: Record<string, string>;
  submitting: boolean;
  onClose: () => void;
  onRatingChange: (userId: string, stars: number) => void;
  onReviewChange: (userId: string, text: string) => void;
  onSubmit: () => void;
};

export default function RatingModal({ visible, rateGame, rateParticipants, ratingSelections, reviewSelections, submitting, onClose, onRatingChange, onReviewChange, onSubmit }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const hasRating = Object.values(ratingSelections).some((s) => s > 0);
  const canSubmit = rateParticipants.length === 0 || hasRating;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>⭐ Rate Players</Text>
            {rateGame && <Text style={styles.subtitle}>{rateGame.sport} · {rateGame.location}</Text>}
          </View>
          <CloseButton onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {rateParticipants.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyText}>You were the only player!</Text>
              <Text style={styles.emptySub}>Nothing to rate — tap Done to complete.</Text>
            </View>
          )}
          {rateParticipants.map((p) => (
            <View key={p.id} style={styles.playerCard}>
              <View style={styles.playerLeft}>
                <AvatarWithFrame
                  avatarUrl={p.avatar_url}
                  initial={p.username}
                  equippedBorderId={p.equipped_border_id}
                  size="small"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.playerName}>{p.username}</Text>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4].map((s) => (
                  <Pressable key={s} onPress={() => onRatingChange(p.id, ratingSelections[p.id] === s ? 0 : s)}>
                    <Text style={{ fontSize: 28, color: s <= (ratingSelections[p.id] ?? 0) ? "#f59e0b" : "#e0e0e0" }}>★</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.reviewInput}
                placeholder="Leave a review (optional)"
                value={reviewSelections[p.id] ?? ""}
                onChangeText={(t) => onReviewChange(p.id, t)}
                multiline
              />
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          {rateParticipants.length > 0 && !hasRating && (
            <Text style={styles.hintText}>Rate at least one player to continue</Text>
          )}
          <Pressable
            style={[styles.doneBtn, !canSubmit && styles.doneBtnDisabled]}
            onPress={onSubmit}
            disabled={submitting || !canSubmit}
          >
            <Text style={styles.doneBtnText}>{submitting ? "Submitting..." : "Done Rating"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(c: Colors, isDark: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: c.borderLight },
    title: { fontSize: 17, fontWeight: "700", color: c.text },
    subtitle: { fontSize: 12, color: c.textFaint, marginTop: 2 },
    content: { padding: 20, paddingBottom: 48 },
    emptyBox: { alignItems: "center", paddingVertical: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 16, fontWeight: "600", color: c.text, marginBottom: 6 },
    emptySub: { fontSize: 13, color: c.textFaint, textAlign: "center" },
    playerCard: { flexDirection: "column", backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, marginBottom: 10 },
    playerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    playerName: { fontSize: 15, fontWeight: "600", color: c.text },
    starsRow: { flexDirection: "row", gap: 4, marginTop: 8 },
    reviewInput: { marginTop: 10, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, fontSize: 13, backgroundColor: c.input, minHeight: 40, color: c.text },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: c.borderLight },
    hintText: { fontSize: 12, color: c.textMuted, textAlign: "center", marginBottom: 8 },
    doneBtn: { backgroundColor: c.primary, borderRadius: 12, padding: 16, alignItems: "center" },
    doneBtnDisabled: { backgroundColor: c.borderLight, opacity: 0.6 },
    doneBtnText: { color: c.primaryText, fontWeight: "700", fontSize: 15 },
  });
}
