import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, Alert, Pressable,
  ScrollView, Animated, Dimensions,
} from "react-native";
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { Game } from "../lib/types";
import { Court, NTU_COURTS, NTU_CENTER, findCourt } from "../lib/courts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, Colors } from "../lib/theme";
import ChatModal from "../components/ChatModal";
import CloseButton from "../components/CloseButton";


const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const PEEK_HEIGHT = 120;
const FULL_HEIGHT = SCREEN_HEIGHT * 0.52;

const SPORT_COLORS: Record<string, string> = {
  Badminton: "#2e7d32",
  Basketball: "#e65100",
  Football: "#1565c0",
  Volleyball: "#880e4f",
  Frisbee: "#6a1b9a",
};

const SPORT_EMOJI: Record<string, string> = {
  Badminton: "🏸",
  Basketball: "🏀",
  Football: "⚽",
  Volleyball: "🏐",
  Frisbee: "🥏",
};

const ALL_SPORTS = ["All", "Badminton", "Basketball", "Football", "Volleyball", "Frisbee"];

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)}m away`;
  return `${(m / 1000).toFixed(1)}km away`;
}

function formatTime(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 0) return "started";
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

type UserLocation = { latitude: number; longitude: number } | null;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current; // 0 = peek, 1 = full

  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [courtGames, setCourtGames] = useState<Game[]>([]);
  const [sheetFull, setSheetFull] = useState(false);
  const [loadingGames, setLoadingGames] = useState(true);
  const [sportFilter, setSportFilter] = useState("All");
  const [chatGame, setChatGame] = useState<Game | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location needed", "Enable location to see how far you are from each court.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  const fetchGames = useCallback(async () => {
    const { data } = await supabase
      .from("games_with_counts").select("*").eq("status", "open").order("start_time", { ascending: true });
    if (data) setGames(data);
    setLoadingGames(false);
  }, []);

  const fetchJoined = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("game_participants").select("game_id").eq("user_name", user.email);
    if (data) setJoinedIds(new Set(data.map((r: any) => r.game_id)));
  }, []);

  useEffect(() => {
    fetchGames();
    fetchJoined();
    const channel = supabase.channel("map-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, fetchGames)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_participants" }, () => {
        fetchGames(); fetchJoined();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGames, fetchJoined]);

  const filteredGames = sportFilter === "All" ? games : games.filter(g => g.sport === sportFilter);

  function openSheet(court: Court) {
    const cGames = filteredGames.filter((g) => {
      const c = findCourt(g.location);
      return c?.id === court.id;
    });
    setSelectedCourt(court);
    setCourtGames(cGames);
    expandSheet();
  }

  function expandSheet() {
    setSheetFull(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }

  function collapseSheet() {
    setSheetFull(false);
    setSelectedCourt(null);
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }

  const sheetHeight = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PEEK_HEIGHT, FULL_HEIGHT],
  });

  function centerOnUser() {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
  }

  async function joinGame(game: Game) {
    if (game.current_players >= game.max_players) { Alert.alert("Full", "This game is already full."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("game_participants").insert({ game_id: game.id, user_name: user.email, user_id: user.id });
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => new Set(prev).add(game.id));
    fetchGames();
    setCourtGames((prev) => prev.map((g) => g.id === game.id ? { ...g, current_players: g.current_players + 1 } : g));
  }

  async function leaveGame(game: Game) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("game_participants").delete().eq("game_id", game.id).eq("user_name", user.email);
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => { const next = new Set(prev); next.delete(game.id); return next; });
    fetchGames();
    setCourtGames((prev) => prev.map((g) => g.id === game.id ? { ...g, current_players: g.current_players - 1 } : g));
  }

  function flyToCourt(game: Game) {
    const court = findCourt(game.location);
    if (!court) return;
    mapRef.current?.animateToRegion(
      { latitude: court.latitude, longitude: court.longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      400
    );
    openSheet(court);
  }

  function courtsWithGames(): Set<string> {
    const ids = new Set<string>();
    filteredGames.forEach((g) => {
      const c = findCourt(g.location);
      if (c) ids.add(c.id);
    });
    return ids;
  }

  // Games sorted by distance for the peek list
  function allGamesSorted(): Game[] {
    if (!userLocation) return filteredGames;
    return [...filteredGames].sort((a, b) => {
      const ca = findCourt(a.location);
      const cb = findCourt(b.location);
      if (!ca || !cb) return 0;
      const da = distanceMeters(userLocation.latitude, userLocation.longitude, ca.latitude, ca.longitude);
      const db = distanceMeters(userLocation.latitude, userLocation.longitude, cb.latitude, cb.longitude);
      return da - db;
    });
  }

  const activeCourtIds = courtsWithGames();
  const sortedGames = allGamesSorted();

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={NTU_CENTER}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {NTU_COURTS.map((court) => {
          const hasGame = activeCourtIds.has(court.id);
          const courtFilteredGames = filteredGames.filter(g => findCourt(g.location)?.id === court.id);
          const totalPlayers = courtFilteredGames.reduce((sum, g) => sum + g.current_players, 0);

          return (
            <Marker
              key={court.id}
              coordinate={{ latitude: court.latitude, longitude: court.longitude }}
              onPress={() => openSheet(court)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.markerOuter, hasGame && styles.markerOuterActive]}>
                <View style={[styles.markerInner, hasGame && styles.markerInnerActive]}>
                  {hasGame ? (
                    <View style={styles.markerContent}>
                      <Text style={styles.markerPlayerCount}>{totalPlayers}p</Text>
                    </View>
                  ) : (
                    <Text style={styles.markerText}>{court.shortName.split(" ")[0]}</Text>
                  )}
                </View>
              </View>
            </Marker>
          );
        })}

        {userLocation && (
          <Circle
            center={userLocation}
            radius={40}
            fillColor="rgba(33,150,243,0.12)"
            strokeColor="rgba(33,150,243,0.35)"
            strokeWidth={1}
          />
        )}
      </MapView>

      {/* Filter pills */}
      <View style={[styles.filterContainer, { top: insets.top + 8 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {ALL_SPORTS.map((sport) => (
            <Pressable
              key={sport}
              style={[styles.filterPill, sportFilter === sport && styles.filterPillActive]}
              onPress={() => setSportFilter(sport)}
            >
              {sport !== "All" && <Text style={styles.filterEmoji}>{SPORT_EMOJI[sport]}</Text>}
              <Text style={[styles.filterText, sportFilter === sport && styles.filterTextActive]}>{sport}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Pressable style={[styles.myLocBtn, { top: insets.top + 56 }]} onPress={centerOnUser}>
        <Text style={styles.myLocIcon}>◎</Text>
      </Pressable>

      {/* Always-visible bottom sheet */}
      <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
        {/* Peek bar — tap to expand */}
        <Pressable onPress={sheetFull ? collapseSheet : expandSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.peekBar}>
            <View>
              <Text style={styles.peekTitle}>
                {loadingGames ? "Loading..." : `${filteredGames.length} game${filteredGames.length !== 1 ? "s" : ""} nearby`}
              </Text>
              <Text style={styles.peekSub}>
                {activeCourtIds.size} court{activeCourtIds.size !== 1 ? "s" : ""} active
              </Text>
            </View>
            <Text style={styles.peekChevron}>{sheetFull ? "▼" : "▲"}</Text>
          </View>
        </Pressable>

        {/* Full sheet content */}
        {sheetFull && (
          <>
            {selectedCourt ? (
              // Court detail view
              <>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{selectedCourt.name}</Text>
                    {userLocation && (
                      <Text style={styles.sheetDist}>
                        {formatDist(distanceMeters(userLocation.latitude, userLocation.longitude, selectedCourt.latitude, selectedCourt.longitude))}
                      </Text>
                    )}
                    <View style={styles.sportsRow}>
                      {selectedCourt.sports.map((s) => (
                        <View key={s} style={[styles.sportTag, { backgroundColor: SPORT_COLORS[s] + "22" }]}>
                          <Text style={[styles.sportTagText, { color: SPORT_COLORS[s] }]}>{SPORT_EMOJI[s]} {s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <CloseButton onPress={collapseSheet} />
                </View>
                <Text style={styles.sheetSectionLabel}>
                  {courtGames.length > 0 ? `${courtGames.length} game${courtGames.length !== 1 ? "s" : ""} here` : "No active games here"}
                </Text>
                <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
                  {courtGames.length === 0 ? (
                    <Text style={styles.noGamesText}>No games right now.{"\n"}Go to the Games tab to create one.</Text>
                  ) : (
                    courtGames.map((game) => <GameRow key={game.id} game={game} joined={joinedIds.has(game.id)} onJoin={joinGame} onLeave={leaveGame} onChat={(g) => setChatGame(g)} />)
                  )}
                </ScrollView>
              </>
            ) : (
              // All games list
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>All Games</Text>
                  <CloseButton onPress={collapseSheet} />
                </View>
                <Text style={styles.sheetSectionLabel}>Sorted by distance</Text>
                <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
                  {sortedGames.length === 0 ? (
                    <Text style={styles.noGamesText}>No games right now.</Text>
                  ) : (
                    sortedGames.map((game) => (
                      <Pressable key={game.id} onPress={() => flyToCourt(game)}>
                        <GameRow game={game} joined={joinedIds.has(game.id)} onJoin={joinGame} onLeave={leaveGame} onChat={(g) => setChatGame(g)} showCourt />
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </>
            )}
          </>
        )}
      </Animated.View>

      <ChatModal
        visible={!!chatGame}
        gameId={chatGame?.id ?? ""}
        gameTitle={chatGame ? `${chatGame.sport} · ${chatGame.location}` : ""}
        onClose={() => setChatGame(null)}
      />
    </View>
  );
}

function GameRow({ game, joined, onJoin, onLeave, onChat, showCourt }: {
  game: Game; joined: boolean; onJoin: (g: Game) => void; onLeave: (g: Game) => void;
  onChat: (g: Game) => void; showCourt?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const full = game.current_players >= game.max_players;
  const pct = Math.round((game.current_players / game.max_players) * 100);
  const barColor = full ? "#bdbdbd" : pct >= 75 ? "#ff9800" : "#4caf50";

  return (
    <View style={styles.gameRow}>
      <View style={styles.gameRowLeft}>
        <View style={styles.gameRowTitleRow}>
          <Text style={styles.gameRowEmoji}>{SPORT_EMOJI[game.sport] ?? "⚡"}</Text>
          <Text style={styles.gameRowSport}>{game.sport}</Text>
        </View>
        {showCourt && <Text style={styles.gameRowCourt}>{game.location}</Text>}
        <Text style={styles.gameRowTime}>{formatTime(game.start_time)}</Text>
        <View style={styles.miniBar}>
          <View style={[styles.miniBarFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
        </View>
        <Text style={styles.gameRowSlots}>{game.current_players} / {game.max_players} players · {game.skill_level}</Text>
      </View>
      <View style={styles.gameRowBtns}>
        <Pressable style={styles.chatBtnRow} onPress={() => onChat(game)}>
          <Text style={styles.chatIconRow}>💬</Text>
        </Pressable>
        {joined ? (
          <>
            <View style={styles.joinedBadge}><Text style={styles.joinedBadgeText}>Joined</Text></View>
            <Pressable style={styles.leaveBtn} onPress={() => onLeave(game)}>
              <Text style={styles.leaveBtnText}>Leave</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={[styles.joinBtn, full && styles.joinBtnDisabled]} onPress={() => !full && onJoin(game)} disabled={full}>
            <Text style={[styles.joinBtnText, full && styles.joinBtnTextDisabled]}>{full ? "Full" : "Join"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function makeStyles(c: Colors) { return StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  filterContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: c.surface + "ee",
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillActive: {
    backgroundColor: "#212121",
    borderColor: "#212121",
  },
  filterEmoji: { fontSize: 13 },
  filterText: { fontSize: 13, fontWeight: "500", color: c.textSub },
  filterTextActive: { color: "#fff", fontWeight: "600" },
  myLocBtn: {
    position: "absolute",
    right: 16,
    top: 72,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  myLocIcon: { fontSize: 20, color: "#1565c0" },
  markerOuter: {
    padding: 3, borderRadius: 10, backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 3, elevation: 3,
  },
  markerOuterActive: { backgroundColor: "#212121", shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  markerInner: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: "#f5f5f5" },
  markerInnerActive: { backgroundColor: "#212121" },
  markerContent: { flexDirection: "row", alignItems: "center", gap: 3 },
  markerEmoji: { fontSize: 10 },
  markerPlayerCount: { fontSize: 10, fontWeight: "700", color: "#fff" },
  markerText: { fontSize: 10, fontWeight: "700", color: "#424242" },
  markerTextActive: { color: "#fff" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: c.border,
    borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 8,
  },
  peekBar: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20, paddingBottom: 12,
  },
  peekTitle: { fontSize: 15, fontWeight: "700", color: c.text },
  peekSub: { fontSize: 12, color: c.textFaint, marginTop: 2 },
  peekChevron: { fontSize: 12, color: c.placeholder },
  sheetHeader: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 20, marginBottom: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: c.text, marginBottom: 2 },
  sheetDist: { fontSize: 12, color: "#1565c0", marginBottom: 8, fontWeight: "500" },
  sportsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  sportTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sportTagText: { fontSize: 11, fontWeight: "600" },
  sheetSectionLabel: {
    fontSize: 11, fontWeight: "600", letterSpacing: 0.6,
    textTransform: "uppercase", color: c.placeholder,
    marginBottom: 8, paddingHorizontal: 20,
  },
  sheetScroll: { flex: 1, paddingHorizontal: 20 },
  noGamesText: { fontSize: 13, color: c.placeholder, lineHeight: 20, textAlign: "center", marginTop: 16 },
  gameRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.borderLight, gap: 12,
  },
  gameRowLeft: { flex: 1 },
  gameRowTitleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  gameRowEmoji: { fontSize: 14 },
  gameRowSport: { fontSize: 14, fontWeight: "600", color: c.text },
  gameRowCourt: { fontSize: 12, color: c.textMuted, marginBottom: 2 },
  gameRowTime: { fontSize: 12, color: c.textFaint, marginBottom: 6 },
  miniBar: { height: 3, backgroundColor: c.borderLight, borderRadius: 2, marginBottom: 4, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 2 },
  gameRowSlots: { fontSize: 11, color: c.textFaint },
  gameRowBtns: { flexDirection: "column", gap: 6, alignItems: "flex-end" },
  chatBtnRow: { paddingHorizontal: 4, paddingVertical: 2 },
  chatIconRow: { fontSize: 16 },
  joinBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  joinBtnDisabled: { borderColor: c.borderLight },
  joinBtnText: { fontSize: 13, fontWeight: "500", color: c.text },
  joinBtnTextDisabled: { color: c.placeholder },
  joinedBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#e8f5e9" },
  joinedBadgeText: { fontSize: 12, fontWeight: "500", color: "#2e7d32" },
  leaveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#fce4ec", borderWidth: 1, borderColor: "#f8bbd0" },
  leaveBtnText: { fontSize: 12, fontWeight: "500", color: "#c62828" },
}); }