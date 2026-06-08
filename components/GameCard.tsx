import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Game } from "../lib/types";
import { useTheme, Colors } from "../lib/theme";

type Props = {
  game: Game;
  isJoined: boolean;
  onJoin: (game: Game) => void;
  onLeave: (game: Game) => void;
  onCancel?: (game: Game) => void;
  onChat?: (game: Game) => void;
  hasUnread?: boolean;
};

const SPORT_COLORS: Record<string, { bg: string; text: string }> = {
  Badminton:  { bg: "#e8f5e9", text: "#2e7d32" },
  Basketball: { bg: "#fff3e0", text: "#e65100" },
  Football:   { bg: "#e3f2fd", text: "#1565c0" },
  Volleyball: { bg: "#fce4ec", text: "#880e4f" },
  Frisbee:    { bg: "#f3e5f5", text: "#6a1b9a" },
};

function formatTime(isoString: string) {
  const diff = new Date(isoString).getTime() - Date.now();
  const totalMins = Math.round(diff / 60000);
  if (totalMins < 0) return "started";
  if (totalMins < 60) return `in ${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

function formatTimeRange(start: string, end: string | null) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function SlotBar({ current, max, colors }: { current: number; max: number; colors: Colors }) {
  const pct = Math.round((current / max) * 100);
  const color = current >= max ? "#4caf50" : pct >= 75 ? "#ff9800" : "#4caf50";
  return (
    <View style={[barStyles.bg, { backgroundColor: colors.borderLight }]}>
      <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  bg: { height: 3, borderRadius: 2, marginBottom: 10, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
});

export default function GameCard({ game, isJoined, onJoin, onLeave, onCancel, onChat, hasUnread }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isFull = game.current_players >= game.max_players;
  const sportColor = SPORT_COLORS[game.sport] ?? { bg: "#f5f5f5", text: "#616161" };
  const isInProgress = game.status === "in_progress";

  return (
    <View style={[styles.card, isJoined && !isInProgress && styles.cardJoined]}>
      <View style={styles.cardTop}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.sportTag, { backgroundColor: sportColor.bg }]}>
            <Text style={[styles.sportTagText, { color: sportColor.text }]}>
              {game.sport}
            </Text>
          </View>
          {isInProgress && (
            <View style={styles.inProgressPill}>
              <View style={styles.inProgressDot} />
              <Text style={styles.inProgressPillText}>In Progress</Text>
            </View>
          )}
        </View>
        <View style={styles.timeGroup}>
          <Text style={styles.timeRange}>{formatTimeRange(game.start_time, game.end_time)}</Text>
          <Text style={styles.timeCountdown}>{formatTime(game.start_time)}</Text>
        </View>
      </View>

      <Text style={styles.location}>{game.location}</Text>
      {!!game.creator_username && (
        <Text style={styles.creatorText}>by {game.creator_username}</Text>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{game.skill_level}</Text>
      </View>

      {!!game.description && (
        <Text style={styles.desc}>{game.description}</Text>
      )}

      <SlotBar current={game.current_players} max={game.max_players} colors={colors} />

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.slotText}>
            {game.current_players} / {game.max_players} players
          </Text>
          {onChat && (
            <Pressable style={styles.chatBtn} onPress={() => onChat(game)}>
              <Text style={styles.chatIcon}>💬</Text>
              {hasUnread && <View style={styles.unreadDot} />}
            </Pressable>
          )}
        </View>

        <View style={styles.btnGroup}>
          {isInProgress ? (
            isJoined ? (
              <View style={styles.playingBadge}>
                <Text style={styles.playingBadgeText}>Playing</Text>
              </View>
            ) : (
              <View style={styles.gameInProgressBtn}>
                <Text style={styles.gameInProgressBtnText}>Game in Progress</Text>
              </View>
            )
          ) : onCancel ? (
            <>
              {isJoined && (
                <View style={styles.joinedBadge}>
                  <Text style={styles.joinedBadgeText}>Joined</Text>
                </View>
              )}
              <Pressable style={styles.cancelBtn} onPress={() => onCancel(game)}>
                <Text style={styles.cancelBtnText}>Delete game</Text>
              </Pressable>
            </>
          ) : isJoined ? (
            <>
              <View style={styles.joinedBadge}>
                <Text style={styles.joinedBadgeText}>Joined</Text>
              </View>
              <Pressable style={styles.leaveBtn} onPress={() => onLeave(game)}>
                <Text style={styles.leaveBtnText}>Leave</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[styles.joinBtn, isFull && styles.joinBtnDisabled]}
              onPress={() => !isFull && onJoin(game)}
              disabled={isFull}
            >
              <Text style={[styles.joinBtnText, isFull && styles.joinBtnTextDisabled]}>
                {isFull ? "Full" : "Join game"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginBottom: 12,
    },
    cardJoined: {
      borderColor: "#4caf50",
    },
    cardInProgress: {
      borderColor: "#1976d2",
      borderWidth: 1.5,
    },
    inProgressPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#e3f2fd",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
    },
    inProgressDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#1976d2",
    },
    inProgressPillText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#1976d2",
    },
    gameInProgressBtn: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: "#1976d2",
    },
    gameInProgressBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#fff",
    },
    playingBadge: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: "#e8f5e9",
    },
    playingBadgeText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#2e7d32",
    },
    cardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    sportTag: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
    },
    sportTagText: {
      fontSize: 12,
      fontWeight: "600",
    },
    timeGroup: {
      alignItems: "flex-end",
    },
    timeRange: {
      fontSize: 12,
      fontWeight: "500",
      color: c.textSub,
    },
    timeCountdown: {
      fontSize: 11,
      color: c.textFaint,
      marginTop: 1,
    },
    location: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
      marginBottom: 2,
    },
    creatorText: {
      fontSize: 11,
      color: c.textFaint,
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: "row",
      marginBottom: 8,
    },
    metaText: {
      fontSize: 12,
      color: c.textMuted,
      borderLeftWidth: 2,
      borderLeftColor: c.border,
      paddingLeft: 8,
    },
    desc: {
      fontSize: 13,
      color: c.textMuted,
      lineHeight: 18,
      marginBottom: 10,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    slotText: {
      fontSize: 12,
      color: c.textFaint,
    },
    chatBtn: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    chatIcon: { fontSize: 16 },
    unreadDot: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#f44336",
    },
    btnGroup: {
      flexDirection: "row",
      gap: 8,
    },
    joinBtn: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    joinBtnDisabled: {
      borderColor: c.borderLight,
    },
    joinBtnText: {
      fontSize: 13,
      fontWeight: "500",
      color: c.text,
    },
    joinBtnTextDisabled: {
      color: c.textFaint,
    },
    joinedBadge: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: "#e8f5e9",
    },
    joinedBadgeText: {
      fontSize: 13,
      fontWeight: "500",
      color: "#2e7d32",
    },
    cancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: "#fce4ec",
      borderWidth: 1,
      borderColor: "#f8bbd0",
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: "500",
      color: "#c62828",
    },
    leaveBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: "#fce4ec",
      borderWidth: 1,
      borderColor: "#f8bbd0",
    },
    leaveBtnText: {
      fontSize: 13,
      fontWeight: "500",
      color: "#c62828",
    },
  });
}
