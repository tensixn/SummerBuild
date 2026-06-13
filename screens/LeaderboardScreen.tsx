import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Image,
  RefreshControl, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useTheme, Colors } from "../lib/theme";
import AvatarWithFrame from "../components/AvatarWithFrame";

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}

function computeStreak(gameDates: string[]): { current: number; longest: number } {
  if (gameDates.length === 0) return { current: 0, longest: 0 };
  const weekSet = new Set(gameDates.map(getMondayOfWeek));
  const sortedWeeks = Array.from(weekSet).sort();
  const now = new Date();
  const todayMonday = getMondayOfWeek(now.toISOString());
  const lastWeekDate = new Date(now);
  lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7);
  const lastWeekMonday = getMondayOfWeek(lastWeekDate.toISOString());
  const mostRecent = sortedWeeks[sortedWeeks.length - 1];
  let current = 0;
  if (mostRecent === todayMonday || mostRecent === lastWeekMonday) {
    let check = mostRecent;
    for (let i = sortedWeeks.length - 1; i >= 0; i--) {
      if (sortedWeeks[i] === check) {
        current++;
        const d = new Date(check);
        d.setUTCDate(d.getUTCDate() - 7);
        check = d.toISOString().split("T")[0];
      } else {
        break;
      }
    }
  }
  let longest = 0;
  let run = 1;
  for (let i = 1; i < sortedWeeks.length; i++) {
    const prev = new Date(sortedWeeks[i - 1]);
    prev.setUTCDate(prev.getUTCDate() + 7);
    if (sortedWeeks[i] === prev.toISOString().split("T")[0]) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run);
  return { current, longest: Math.max(longest, current) };
}

type LeaderEntry = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  equippedBorderId: string | null;
  current: number;
  longest: number;
};


const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [allEntries, setAllEntries] = useState<LeaderEntry[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<"global" | "friends">("global");

  const scrollRef = useRef<ScrollView>(null);
  const myRowY = useRef<number>(-1);

  const fetchLeaderboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    // Fetch friend IDs in parallel with game data
    const [friendsRes, closedGamesRes] = await Promise.all([
      supabase.from("friends")
        .select("requester_id, receiver_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`),
      supabase.from("games").select("id, start_time").eq("status", "completed"),
    ]);

    const ids = new Set<string>();
    (friendsRes.data ?? []).forEach((r: any) => {
      ids.add(r.requester_id === user.id ? r.receiver_id : r.requester_id);
    });
    setFriendIds(ids);

    const closedGames = closedGamesRes.data;
    if (!closedGames || closedGames.length === 0) {
      setAllEntries([]);
      return;
    }

    const closedGameIds = closedGames.map((g: any) => g.id);
    const startTimeMap: Record<string, string> = {};
    closedGames.forEach((g: any) => { startTimeMap[g.id] = g.start_time; });

    const { data: participants } = await supabase
      .from("game_participants")
      .select("user_id, game_id")
      .not("user_id", "is", null)
      .in("game_id", closedGameIds);

    if (!participants || participants.length === 0) {
      setAllEntries([]);
      return;
    }

    const userGameDates: Record<string, string[]> = {};
    for (const p of participants as any[]) {
      if (!p.user_id) continue;
      if (!userGameDates[p.user_id]) userGameDates[p.user_id] = [];
      if (startTimeMap[p.game_id]) userGameDates[p.user_id].push(startTimeMap[p.game_id]);
    }

    const streaks = Object.keys(userGameDates).map((uid) => ({
      userId: uid,
      ...computeStreak(userGameDates[uid]),
    }));
    streaks.sort((a, b) => b.longest - a.longest || b.current - a.current);

    const allIds = streaks.map((s) => s.userId);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, equipped_border_id")
      .in("id", allIds);

    const profileMap: Record<string, { username: string; avatar_url: string | null; equipped_border_id: string | null }> = {};
    (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    setAllEntries(
      streaks.map((s) => ({
        userId: s.userId,
        username: profileMap[s.userId]?.username ?? "Unknown",
        avatarUrl: profileMap[s.userId]?.avatar_url ?? null,
        equippedBorderId: profileMap[s.userId]?.equipped_border_id ?? null,
        current: s.current,
        longest: s.longest,
      }))
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    myRowY.current = -1;
    fetchLeaderboard().finally(() => setLoading(false));
  }, [fetchLeaderboard]);

  async function onRefresh() {
    setRefreshing(true);
    myRowY.current = -1;
    await fetchLeaderboard();
    setRefreshing(false);
  }

  // Derive displayed list from mode
  const entries = useMemo(() => {
    if (mode === "global") return allEntries.slice(0, 50);
    // Friends tab: include self + friends, re-rank among them
    return allEntries.filter(
      (e) => e.userId === currentUserId || friendIds.has(e.userId)
    );
  }, [mode, allEntries, currentUserId, friendIds]);

  function scrollToMe() {
    if (myRowY.current >= 0) {
      scrollRef.current?.scrollTo({ y: Math.max(0, myRowY.current - 20), animated: true });
    }
  }

  // Reset scroll + row position when switching tabs
  function switchMode(next: "global" | "friends") {
    myRowY.current = -1;
    setMode(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  const meIndex = entries.findIndex((e) => e.userId === currentUserId);
  const showFindMe = !loading && meIndex >= 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1 }}>
        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, mode === "global" && styles.tabActive]}
            onPress={() => switchMode("global")}
          >
            <Text style={[styles.tabText, mode === "global" && styles.tabTextActive]}>
              🌐 Global
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === "friends" && styles.tabActive]}
            onPress={() => switchMode("friends")}
          >
            <Text style={[styles.tabText, mode === "friends" && styles.tabTextActive]}>
              👥 Friends
            </Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.title}>Leaderboards</Text>
          <Text style={styles.subtitle}>
            {mode === "global"
              ? "Top 50 players by best weekly streak"
              : "Best weekly streak among your friends"}
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} />
          ) : entries.length === 0 ? (
            <Text style={styles.empty}>
              {mode === "friends"
                ? "None of your friends have completed a game yet."
                : "No completed games yet — check back after games finish!"}
            </Text>
          ) : (
            entries.map((entry, index) => {
              const isMe = entry.userId === currentUserId;
              const TOP3_BORDER = ["#F59E0B", "#9CA3AF", "#CD7C2F"];
              const topBorder = index < 3 ? { borderLeftWidth: 4, borderLeftColor: TOP3_BORDER[index] } : undefined;
              return (
                <View
                  key={entry.userId}
                  style={[styles.row, isMe && styles.rowMe, topBorder]}
                  onLayout={isMe ? (e) => { myRowY.current = e.nativeEvent.layout.y; } : undefined}
                >
                  <View style={styles.rankBox}>
                    {index < 3 ? (
                      <Text style={styles.medal}>{MEDALS[index]}</Text>
                    ) : (
                      <Text style={styles.rank}>#{index + 1}</Text>
                    )}
                  </View>

                  <AvatarWithFrame
                    avatarUrl={entry.avatarUrl}
                    initial={entry.username}
                    equippedBorderId={entry.equippedBorderId}
                    size="small"
                  />

                  <View style={styles.info}>
                    <Text style={[styles.username, isMe && styles.usernameMe]} numberOfLines={1}>
                      {entry.username}{isMe ? " (you)" : ""}
                    </Text>
                    <Text style={styles.currentStreak}>
                      Current streak: {entry.current} {entry.current === 1 ? "week" : "weeks"}
                    </Text>
                  </View>

                  <View style={styles.streakBox}>
                    <Text style={[styles.streakNum, isMe && styles.streakNumMe]}>
                      {entry.longest}
                    </Text>
                    <Text style={styles.streakLabel}>wk best</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {showFindMe && (
          <Pressable style={styles.findMeBtn} onPress={scrollToMe}>
            <Text style={styles.findMeBtnText}>📍 #{meIndex + 1} — Find Me</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    tabRow: {
      flexDirection: "row",
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 4,
      backgroundColor: c.borderLight,
      borderRadius: 12,
      padding: 3,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: "center",
    },
    tabActive: {
      backgroundColor: c.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
      color: c.textMuted,
    },
    tabTextActive: {
      color: c.text,
    },
    container: { padding: 20, paddingBottom: 100 },
    title: { fontSize: 26, fontWeight: "700", color: c.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: c.textFaint, marginBottom: 24 },
    empty: {
      textAlign: "center",
      color: c.textFaint,
      marginTop: 60,
      fontSize: 15,
      lineHeight: 22,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 10,
      gap: 12,
    },
    rowMe: {
      borderColor: "#22c55e",
      borderWidth: 1.5,
    },
    rankBox: { width: 34, alignItems: "center" },
    medal: { fontSize: 24 },
    rank: { fontSize: 14, fontWeight: "600", color: c.textMuted },
    avatarRing: { borderRadius: 25, padding: 2 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.borderLight,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { fontSize: 18, fontWeight: "700", color: c.textMuted },
    info: { flex: 1 },
    username: { fontSize: 15, fontWeight: "600", color: c.text },
    usernameMe: { color: "#22c55e" },
    currentStreak: { fontSize: 12, color: c.textFaint, marginTop: 2 },
    streakBox: { alignItems: "center", minWidth: 52 },
    streakNum: { fontSize: 24, fontWeight: "700", color: "#22c55e" },
    streakNumMe: { color: "#16a34a" },
    streakLabel: { fontSize: 11, color: c.textFaint, marginTop: 1 },
    findMeBtn: {
      position: "absolute",
      bottom: 70,
      alignSelf: "center",
      backgroundColor: "#22c55e",
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 22,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    findMeBtnText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
    },
  });
}
