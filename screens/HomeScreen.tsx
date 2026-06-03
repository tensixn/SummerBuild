import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { supabase } from "../lib/supabase";
import { Game, Sport, SPORTS, DEMO_USER } from "../lib/types";
import GameCard from "../components/GameCard";
import CreateGameModal from "../components/CreateGameModal";

export default function HomeScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Sport>("All");
  const [modalVisible, setModalVisible] = useState(false);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("games_with_counts")
      .select("*")
      .eq("status", "open")
      .order("start_time", { ascending: true });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setGames(data ?? []);
    }
    setLoading(false);
  }, []);

  const fetchJoined = useCallback(async () => {
    const { data } = await supabase
      .from("game_participants")
      .select("game_id")
      .eq("user_name", DEMO_USER);

    if (data) {
      setJoinedIds(new Set(data.map((r) => r.game_id)));
    }
  }, []);

  useEffect(() => {
    fetchGames();
    fetchJoined();

    const channel = supabase
      .channel("games-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, fetchGames)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_participants" }, () => {
        fetchGames();
        fetchJoined();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchGames, fetchJoined]);

  async function joinGame(game: Game) {
    if (game.current_players >= game.max_players) {
      Alert.alert("Full", "This game is already full.");
      return;
    }
    const { error } = await supabase
      .from("game_participants")
      .insert({ game_id: game.id, user_name: DEMO_USER });

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setJoinedIds((prev) => new Set(prev).add(game.id));
    fetchGames();
  }

  async function leaveGame(game: Game) {
    const { error } = await supabase
      .from("game_participants")
      .delete()
      .eq("game_id", game.id)
      .eq("user_name", DEMO_USER);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setJoinedIds((prev) => {
      const next = new Set(prev);
      next.delete(game.id);
      return next;
    });
    fetchGames();
  }

  const filtered =
    filter === "All" ? games : games.filter((g) => g.sport === filter);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.appName}>NTU Sports</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>live</Text>
          </View>
        </View>
        <Text style={styles.sub}>Find and join pickup games around campus</Text>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <FlatList
                data={SPORTS}
                keyExtractor={(s) => s}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.chip, filter === item && styles.chipActive]}
                    onPress={() => setFilter(item)}
                  >
                    <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                )}
              />

              <Pressable style={styles.createBtn} onPress={() => setModalVisible(true)}>
                <Text style={styles.createBtnText}>+ Create a game</Text>
              </Pressable>

              <Text style={styles.sectionLabel}>Open games</Text>

              {loading && <ActivityIndicator style={{ marginTop: 32 }} />}
            </>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  No {filter === "All" ? "" : filter.toLowerCase() + " "}games right now.{"\n"}
                  Create one!
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <GameCard
              game={item}
              isJoined={joinedIds.has(item.id)}
              onJoin={joinGame}
              onLeave={leaveGame}
            />
          )}
          contentContainerStyle={styles.list}
        />
      </View>

      <CreateGameModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={fetchGames}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    marginBottom: 2,
  },
  appName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#212121",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4caf50",
  },
  liveText: {
    fontSize: 12,
    color: "#9e9e9e",
  },
  sub: {
    fontSize: 13,
    color: "#9e9e9e",
    marginBottom: 16,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: "#212121",
    borderColor: "#212121",
  },
  chipText: {
    fontSize: 13,
    color: "#757575",
  },
  chipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  createBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#bdbdbd",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  createBtnText: {
    fontSize: 14,
    color: "#757575",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "#bdbdbd",
    marginBottom: 12,
  },
  list: {
    paddingBottom: 40,
  },
  empty: {
    alignItems: "center",
    paddingTop: 48,
  },
  emptyText: {
    fontSize: 14,
    color: "#bdbdbd",
    textAlign: "center",
    lineHeight: 22,
  },
});