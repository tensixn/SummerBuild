import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme, Colors } from "../lib/theme";
import { Game } from "../lib/types";

type Props = {
  games: Game[];
  expanded: boolean;
  onToggle: () => void;
  onOpenGame: (game: Game) => void;
};

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-SG", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function UpcomingGamesSection({ games, expanded, onToggle, onOpenGame }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (games.length === 0) return null;

  return (
    <View style={styles.section}>
      <Pressable style={styles.header} onPress={onToggle}>
        <Text style={styles.title}>📅 Your Upcoming Games ({games.length})</Text>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded && games.map((game) => (
        <Pressable key={game.id} style={styles.card} onPress={() => onOpenGame(game)}>
          <View style={styles.cardLeft}>
            <Text style={styles.sport}>{game.sport}</Text>
            <Text style={styles.location}>{game.location}</Text>
            <Text style={styles.time}>{formatDate(game.start_time)}</Text>
          </View>
          <View style={styles.slots}>
            <Text style={styles.slotsNum}>{game.current_players}/{game.max_players}</Text>
            <Text style={styles.slotsLabel}>players</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    section: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 20, overflow: "hidden" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
    title: { fontSize: 14, fontWeight: "600", color: c.text },
    chevron: { fontSize: 12, color: c.textFaint },
    card: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.borderLight },
    cardLeft: { flex: 1 },
    sport: { fontSize: 14, fontWeight: "600", color: c.text, marginBottom: 2 },
    location: { fontSize: 12, color: c.textMuted, marginBottom: 2 },
    time: { fontSize: 11, color: c.textFaint },
    slots: { alignItems: "center" },
    slotsNum: { fontSize: 16, fontWeight: "700", color: c.text },
    slotsLabel: { fontSize: 10, color: c.textFaint },
  });
}
