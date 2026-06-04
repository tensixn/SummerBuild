import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  Alert, StyleSheet, SafeAreaView, Modal, ScrollView, Image, TextInput,
} from "react-native";
import { supabase } from "../lib/supabase";
import { Game, Sport, SPORTS } from "../lib/types";
import GameCard from "../components/GameCard";
import CreateGameModal from "../components/CreateGameModal";

type Participant = {
  user_name: string;
  profile?: {
    id: string;
    username: string;
    avatar_url: string | null;
    sports_interests: string[];
  } | null;
};

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  sports_interests: string[];
};

type Review = {
  id: string;
  reviewer_name: string;
  comment: string;
  created_at: string;
};

export default function HomeScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Sport>("All");
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profileReviews, setProfileReviews] = useState<Review[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("games_with_counts").select("*").eq("status", "open").order("start_time", { ascending: true });
    if (error) Alert.alert("Error", error.message);
    else setGames(data ?? []);
    setLoading(false);
  }, []);

  const fetchJoined = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("game_participants").select("game_id").eq("user_name", user.email);
    if (data) setJoinedIds(new Set(data.map((r) => r.game_id)));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    fetchGames();
    fetchJoined();
    const channel = supabase.channel("games-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, fetchGames)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_participants" }, () => { fetchGames(); fetchJoined(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGames, fetchJoined]);

  async function openGame(game: Game) {
  setSelectedGame(game);
  setLoadingParticipants(true);
  const { data } = await supabase
    .from("game_participants").select("user_name").eq("game_id", game.id);
  if (!data) { setLoadingParticipants(false); return; }

  const withProfiles: Participant[] = await Promise.all(
    data.map(async (p) => {
      // Look up user by email in auth, then find their profile
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const authUser = users?.find((u) => u.email === p.user_name);
      if (!authUser) return { user_name: p.user_name, profile: null };

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, sports_interests")
        .eq("id", authUser.id)
        .single();
      return { user_name: p.user_name, profile: profile ?? null };
    })
  );
  setParticipants(withProfiles);
  setLoadingParticipants(false);
}

  async function openProfile(profile: Profile) {
    setSelectedProfile(profile);
    const { data } = await supabase.from("reviews").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false });
    if (data) setProfileReviews(data);
  }

  async function submitReview() {
    if (!reviewText.trim() || !selectedProfile) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (user.id === selectedProfile.id) { Alert.alert("Not allowed", "You cannot review yourself."); return; }
    setSubmittingReview(true);
    const { error } = await supabase.from("reviews").insert({
      profile_id: selectedProfile.id,
      reviewer_name: user.email?.split("@")[0] ?? "Anonymous",
      comment: reviewText.trim(),
    });
    setSubmittingReview(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setReviewText("");
    const { data } = await supabase.from("reviews").select("*").eq("profile_id", selectedProfile.id).order("created_at", { ascending: false });
    if (data) setProfileReviews(data);
  }

  async function joinGame(game: Game) {
    if (game.current_players >= game.max_players) { Alert.alert("Full", "This game is already full."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("game_participants").insert({ game_id: game.id, user_name: user.email });
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => new Set(prev).add(game.id));
    fetchGames();
  }

  async function leaveGame(game: Game) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("game_participants").delete().eq("game_id", game.id).eq("user_name", user.email);
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => { const next = new Set(prev); next.delete(game.id); return next; });
    fetchGames();
  }

  function cancelGame(game: Game) {
    Alert.alert("Cancel game?", "This will remove the game for all players.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel game", style: "destructive", onPress: async () => {
        const { error } = await supabase.from("games").update({ status: "cancelled" }).eq("id", game.id);
        if (error) Alert.alert("Error", error.message);
        else fetchGames();
      }},
    ]);
  }

  function formatTime(isoString: string) {
    const diff = new Date(isoString).getTime() - Date.now();
    const mins = Math.round(diff / 60000);
    if (mins < 0) return "started";
    if (mins < 60) return `in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  }

  const filtered = filter === "All" ? games : games.filter((g) => g.sport === filter);

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
                data={SPORTS} keyExtractor={(s) => s} horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                renderItem={({ item }) => (
                  <Pressable style={[styles.chip, filter === item && styles.chipActive]} onPress={() => setFilter(item)}>
                    <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>{item}</Text>
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
                <Text style={styles.emptyText}>No {filter === "All" ? "" : filter.toLowerCase() + " "}games right now.{"\n"}Create one!</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => openGame(item)}>
              <GameCard
                game={item}
                isJoined={joinedIds.has(item.id)}
                onJoin={joinGame}
                onLeave={leaveGame}
                onCancel={item.created_by === currentUserId ? cancelGame : undefined}
              />
            </Pressable>
          )}
          contentContainerStyle={styles.list}
        />
      </View>

      <CreateGameModal visible={modalVisible} onClose={() => setModalVisible(false)} onCreated={fetchGames} />

      {/* Game Detail Modal */}
      <Modal visible={selectedGame !== null} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedGame?.sport} · {selectedGame?.location}</Text>
            <Pressable onPress={() => { setSelectedGame(null); setParticipants([]); }}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.gameInfoRow}>
              <Text style={styles.gameInfoText}>🕐 {selectedGame ? formatTime(selectedGame.start_time) : ""}</Text>
              <Text style={styles.gameInfoText}>👥 {selectedGame?.current_players}/{selectedGame?.max_players} players</Text>
              <Text style={styles.gameInfoText}>⚡ {selectedGame?.skill_level}</Text>
            </View>

            <Text style={styles.sectionLabel}>Players Joined</Text>
            {loadingParticipants ? (
              <ActivityIndicator style={{ marginTop: 16 }} />
            ) : participants.length === 0 ? (
              <Text style={styles.emptyText}>No one has joined yet.</Text>
            ) : (
              participants.map((p) => (
                <Pressable
                  key={p.user_name}
                  style={styles.participantCard}
                  onPress={() => p.profile && openProfile(p.profile)}
                >
                  {p.profile?.avatar_url ? (
                    <Image source={{ uri: p.profile.avatar_url }} style={styles.participantAvatar} />
                  ) : (
                    <View style={styles.participantAvatarPlaceholder}>
                      <Text style={styles.participantAvatarText}>
                        {(p.profile?.username ?? p.user_name)[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>{p.profile?.username ?? p.user_name}</Text>
                    {p.profile?.sports_interests && p.profile.sports_interests.length > 0 && (
                      <Text style={styles.participantSports} numberOfLines={1}>
                        {p.profile.sports_interests.join(" · ")}
                      </Text>
                    )}
                  </View>
                  {p.profile && <Text style={styles.participantArrow}>›</Text>}
                </Pressable>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Profile Modal */}
      <Modal visible={selectedProfile !== null} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Profile</Text>
            <Pressable onPress={() => { setSelectedProfile(null); setProfileReviews([]); setReviewText(""); }}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.profileHeader}>
              {selectedProfile?.avatar_url ? (
                <Image source={{ uri: selectedProfile.avatar_url }} style={styles.profileAvatar} />
              ) : (
                <View style={styles.profileAvatarPlaceholder}>
                  <Text style={styles.profileAvatarText}>
                    {(selectedProfile?.username ?? "?")[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.profileUsername}>{selectedProfile?.username}</Text>
            </View>

            <Text style={styles.sectionLabel}>Sports Interests</Text>
            <View style={styles.sportsRow}>
              {(selectedProfile?.sports_interests ?? []).length > 0 ? (
                selectedProfile?.sports_interests.map((sport) => (
                  <View key={sport} style={styles.sportChip}>
                    <Text style={styles.sportChipText}>{sport}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noSportsText}>No sports interests listed.</Text>
              )}
            </View>

            <Text style={styles.sectionLabel}>Leave a Review</Text>
            <View style={styles.reviewInputRow}>
              <TextInput
                style={styles.reviewInput}
                placeholder="Write a comment..."
                value={reviewText}
                onChangeText={setReviewText}
                multiline
              />
              <Pressable
                style={[styles.reviewSubmitBtn, !reviewText.trim() && styles.reviewSubmitBtnDisabled]}
                onPress={submitReview}
                disabled={submittingReview || !reviewText.trim()}
              >
                <Text style={styles.reviewSubmitText}>Post</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Reviews ({profileReviews.length})</Text>
            {profileReviews.length === 0 ? (
              <Text style={styles.emptyText}>No reviews yet.</Text>
            ) : (
              profileReviews.map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewerName}>{r.reviewer_name}</Text>
                    <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.reviewComment}>{r.comment}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fafafa" },
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, marginBottom: 2 },
  appName: { fontSize: 22, fontWeight: "700", color: "#212121" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4caf50" },
  liveText: { fontSize: 12, color: "#9e9e9e" },
  sub: { fontSize: 13, color: "#9e9e9e", marginBottom: 16 },
  filterRow: { gap: 8, paddingBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#212121", borderColor: "#212121" },
  chipText: { fontSize: 13, color: "#757575" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  createBtn: { borderWidth: 1, borderStyle: "dashed", borderColor: "#bdbdbd", borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 20, backgroundColor: "#fff" },
  createBtnText: { fontSize: 14, color: "#757575" },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase", color: "#bdbdbd", marginBottom: 12, marginTop: 20 },
  list: { paddingBottom: 40 },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyText: { fontSize: 14, color: "#bdbdbd", textAlign: "center", lineHeight: 22 },
  modalSafe: { flex: 1, backgroundColor: "#fafafa" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#212121", flex: 1, marginRight: 8 },
  modalClose: { fontSize: 16, color: "#9e9e9e" },
  modalContent: { padding: 20, paddingBottom: 48 },
  gameInfoRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 8 },
  gameInfoText: { fontSize: 13, color: "#757575" },
  participantCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0", padding: 12, marginBottom: 10 },
  participantAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  participantAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#212121", alignItems: "center", justifyContent: "center", marginRight: 12 },
  participantAvatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 15, fontWeight: "600", color: "#212121", marginBottom: 2 },
  participantSports: { fontSize: 12, color: "#9e9e9e" },
  participantArrow: { fontSize: 20, color: "#bdbdbd" },
  profileHeader: { alignItems: "center", marginBottom: 24 },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  profileAvatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#212121", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  profileAvatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  profileUsername: { fontSize: 20, fontWeight: "700", color: "#212121" },
  sportsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  sportChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#212121", borderWidth: 1, borderColor: "#212121" },
  sportChipText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  noSportsText: { fontSize: 13, color: "#9e9e9e", fontStyle: "italic" },
  reviewInputRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  reviewInput: { flex: 1, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: "#fff", minHeight: 44 },
  reviewSubmitBtn: { paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#212121", justifyContent: "center" },
  reviewSubmitBtnDisabled: { backgroundColor: "#bdbdbd" },
  reviewSubmitText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  reviewCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0", padding: 14, marginBottom: 10 },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  reviewerName: { fontSize: 13, fontWeight: "600", color: "#212121" },
  reviewDate: { fontSize: 11, color: "#9e9e9e" },
  reviewComment: { fontSize: 13, color: "#424242", lineHeight: 20 },
});