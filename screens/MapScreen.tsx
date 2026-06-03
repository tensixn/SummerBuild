import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { Game } from "../lib/types";
import { Court, NTU_COURTS, NTU_CENTER, findCourt } from "../lib/courts";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.42;

const SPORT_COLORS: Record<string, string> = {
  Badminton: "#2e7d32",
  Basketball: "#e65100",
  Football: "#1565c0",
  Volleyball: "#880e4f",
  Frisbee: "#6a1b9a",
};

function distanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
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
  const mapRef = useRef<MapView>(null);
  const sheetAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [courtGames, setCourtGames] = useState<Game[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingGames, setLoadingGames] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location needed",
          "Enable location to see how far you are from each court."
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  const fetchGames = useCallback(async () => {
    const { data } = await supabase
      .from("games_with_counts")
      .select("*")
      .eq("status", "open")
      .order("start_time", { ascending: true });
    if (data) setGames(data);
    setLoadingGames(false);
  }, []);

  const fetchJoined = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("game_participants")
      .select("game_id")
      .eq("user_name", user.email);
    if (data) setJoinedIds(new Set(data.map((r) => r.game_id)));
  }, []);

  useEffect(() => {
    fetchGames();
    fetchJoined();
    const channel = supabase
      .channel("map-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, fetchGames)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_participants" }, () => {
        fetchGames();
        fetchJoined();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGames, fetchJoined]);

  function openSheet(court: Court) {
    const cGames = games.filter((g) => {
      const c = findCourt(g.location);
      return c?.id === court.id;
    });
    setSelectedCourt(court);
    setCourtGames(cGames);
    setSheetOpen(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }

  function closeSheet() {
    Animated.timing(sheetAnim, {
      toValue: SHEET_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setSheetOpen(false);
      setSelectedCourt(null);
    });
  }

  function centerOnUser() {
    if (!userLocation) return;
    mapRef.current?.animateToRegion(
      {
        ...userLocation,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      500
    );
  }

  async function joinGame(game: Game) {
    if (game.current_players >= game.max_players) {
      Alert.alert("Full", "This game is already full.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("game_participants")
      .insert({ game_id: game.id, user_name: user.email });
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => new Set(prev).add(game.id));
    fetchGames();
    setCourtGames((prev) =>
      prev.map((g) =>
        g.id === game.id
          ? { ...g, current_players: g.current_players + 1 }
          : g
      )
    );
  }

  async function leaveGame(game: Game) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("game_participants")
      .delete()
      .eq("game_id", game.id)
      .eq("user_name", user.email);
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => {
      const next = new Set(prev);
      next.delete(game.id);
      return next;
    });
    fetchGames();
    setCourtGames((prev) =>
      prev.map((g) =>
        g.id === game.id
          ? { ...g, current_players: g.current_players - 1 }
          : g
      )
    );
  }

  function courtsWithGames(): Set<string> {
    const ids = new Set<string>();
    games.forEach((g) => {
      const c = findCourt(g.location);
      if (c) ids.add(c.id);
    });
    return ids;
  }

  const activeCourtIds = courtsWithGames();

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
          return (
            <Marker
              key={court.id}
              coordinate={{ latitude: court.latitude, longitude: court.longitude }}
              onPress={() => openSheet(court)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.markerOuter, hasGame && styles.markerOuterActive]}>
                <View style={[styles.markerInner, hasGame && styles.markerInnerActive]}>
                  <Text style={[styles.markerText, hasGame && styles.markerTextActive]}>
                    {court.shortName.split(" ")[0]}
                  </Text>
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

      <View style={styles.headerOverlay}>
        <Text style={styles.headerTitle}>NTU Courts</Text>
        {loadingGames ? (
          <ActivityIndicator size="small" color="#212121" />
        ) : (
          <Text style={styles.headerSub}>
            {activeCourtIds.size} court{activeCourtIds.size !== 1 ? "s" : ""} with active games
          </Text>
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#212121" }]} />
          <Text style={styles.legendText}>Active game</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#bdbdbd" }]} />
          <Text style={styles.legendText}>No games</Text>
        </View>
      </View>

      <Pressable style={styles.myLocBtn} onPress={centerOnUser}>
        <Text style={styles.myLocIcon}>◎</Text>
      </Pressable>

      {sheetOpen && selectedCourt && (
        <>
          <Pressable style={styles.sheetBackdrop} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: sheetAnim }] },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{selectedCourt.name}</Text>
                {userLocation && (
                  <Text style={styles.sheetDist}>
                    {formatDist(
                      distanceMeters(
                        userLocation.latitude,
                        userLocation.longitude,
                        selectedCourt.latitude,
                        selectedCourt.longitude
                      )
                    )}
                  </Text>
                )}
                <View style={styles.sportsRow}>
                  {selectedCourt.sports.map((s) => (
                    <View
                      key={s}
                      style={[styles.sportTag, { backgroundColor: SPORT_COLORS[s] + "22" }]}
                    >
                      <Text style={[styles.sportTagText, { color: SPORT_COLORS[s] }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Pressable onPress={closeSheet} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.sheetSectionLabel}>
              {courtGames.length > 0
                ? `${courtGames.length} game${courtGames.length !== 1 ? "s" : ""} here`
                : "No active games here"}
            </Text>

            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {courtGames.length === 0 ? (
                <Text style={styles.noGamesText}>
                  No games right now.{"\n"}Go to the Games tab to create one.
                </Text>
              ) : (
                courtGames.map((game) => {
                  const joined = joinedIds.has(game.id);
                  const full = game.current_players >= game.max_players;
                  const pct = Math.round((game.current_players / game.max_players) * 100);
                  const barColor = full ? "#bdbdbd" : pct >= 75 ? "#ff9800" : "#4caf50";
                  return (
                    <View key={game.id} style={styles.gameRow}>
                      <View style={styles.gameRowLeft}>
                        <Text style={styles.gameRowSport}>{game.sport}</Text>
                        <Text style={styles.gameRowTime}>{formatTime(game.start_time)}</Text>
                        <View style={styles.miniBar}>
                          <View
                            style={[
                              styles.miniBarFill,
                              { width: `${pct}%` as any, backgroundColor: barColor },
                            ]}
                          />
                        </View>
                        <Text style={styles.gameRowSlots}>
                          {game.current_players} / {game.max_players} players · {game.skill_level}
                        </Text>
                      </View>
                      <View style={styles.gameRowBtns}>
                        {joined ? (
                          <>
                            <View style={styles.joinedBadge}>
                              <Text style={styles.joinedBadgeText}>Joined</Text>
                            </View>
                            <Pressable style={styles.leaveBtn} onPress={() => leaveGame(game)}>
                              <Text style={styles.leaveBtnText}>Leave</Text>
                            </Pressable>
                          </>
                        ) : (
                          <Pressable
                            style={[styles.joinBtn, full && styles.joinBtnDisabled]}
                            onPress={() => !full && joinGame(game)}
                            disabled={full}
                          >
                            <Text style={[styles.joinBtnText, full && styles.joinBtnTextDisabled]}>
                              {full ? "Full" : "Join"}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  headerOverlay: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: "#ffffffee",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#212121" },
  headerSub: { fontSize: 12, color: "#757575" },
  legend: {
    position: "absolute",
    top: 116,
    left: 16,
    backgroundColor: "#ffffffee",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: "#616161" },
  myLocBtn: {
    position: "absolute",
    right: 16,
    top: 116,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
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
    padding: 3,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  markerOuterActive: {
    backgroundColor: "#212121",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  markerInner: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "#f5f5f5",
  },
  markerInnerActive: {
    backgroundColor: "#212121",
  },
  markerText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#424242",
  },
  markerTextActive: {
    color: "#fff",
  },
  sheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 2,
  },
  sheetDist: {
    fontSize: 12,
    color: "#1565c0",
    marginBottom: 8,
    fontWeight: "500",
  },
  sportsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  sportTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sportTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  closeBtnText: {
    fontSize: 12,
    color: "#757575",
  },
  sheetSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#bdbdbd",
    marginBottom: 10,
  },
  sheetScroll: { flex: 1 },
  noGamesText: {
    fontSize: 13,
    color: "#bdbdbd",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 16,
  },
  gameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
    gap: 12,
  },
  gameRowLeft: { flex: 1 },
  gameRowSport: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 2,
  },
  gameRowTime: {
    fontSize: 12,
    color: "#9e9e9e",
    marginBottom: 6,
  },
  miniBar: {
    height: 3,
    backgroundColor: "#f5f5f5",
    borderRadius: 2,
    marginBottom: 4,
    overflow: "hidden",
  },
  miniBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  gameRowSlots: {
    fontSize: 11,
    color: "#9e9e9e",
  },
  gameRowBtns: {
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
  },
  joinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bdbdbd",
  },
  joinBtnDisabled: {
    borderColor: "#e0e0e0",
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#212121",
  },
  joinBtnTextDisabled: {
    color: "#bdbdbd",
  },
  joinedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e8f5e9",
  },
  joinedBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#2e7d32",
  },
  leaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fce4ec",
    borderWidth: 1,
    borderColor: "#f8bbd0",
  },
  leaveBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#c62828",
  },
});