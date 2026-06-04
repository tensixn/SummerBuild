import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  Alert, StyleSheet, SafeAreaView, Modal, ScrollView, Image, TextInput, RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import { Game, Sport, SPORTS } from "../lib/types";
import GameCard from "../components/GameCard";
import CreateGameModal from "../components/CreateGameModal";

type Participant = {
  user_name: string;
  profile_id: string | null;
  username: string | null;
  avatar_url: string | null;
  sports_interests: string[] | null;
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

type Notification = {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: string | null;
  related_user_id: string | null;
};

export default function HomeScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [profileInDetail, setProfileInDetail] = useState<Profile | null>(null);
  const [profileInDetailReviews, setProfileInDetailReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);

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

  const fetchUpcoming = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: participations } = await supabase.from("game_participants").select("game_id").eq("user_name", user.email);
    if (!participations || participations.length === 0) { setUpcomingGames([]); return; }
    const ids = participations.map((p) => p.game_id);
    const { data: games } = await supabase.from("games_with_counts").select("*").in("id", ids).eq("status", "open").gte("start_time", new Date().toISOString()).order("start_time", { ascending: true });
    if (games) setUpcomingGames(games);
  }, []);

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_email", user.email).eq("is_read", false).order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setNotifications(data);
      if (data.some((n) => n.type !== "friend_request")) setShowNotifModal(true);
    }
  }, []);

  const fetchAllNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_email", user.email).order("created_at", { ascending: false });
    if (data) setAllNotifications(data);
  }, []);

  async function markNotificationsRead() {
    const ids = notifications.filter((n) => n.type !== "friend_request").map((n) => n.id);
    if (ids.length > 0) await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    setNotifications((prev) => prev.filter((n) => n.type === "friend_request"));
    setShowNotifModal(false);
    fetchAllNotifications();
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_email", user.email).eq("is_read", false).neq("type", "friend_request");
    setNotifications((prev) => prev.filter((n) => n.type === "friend_request"));
    setShowNotifModal(false);
    fetchAllNotifications();
  }

  async function acceptFriendRequest(n: Notification) {
    if (!n.related_user_id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("friends").update({ status: "accepted" }).eq("requester_id", n.related_user_id).eq("receiver_id", user.id);
    if (error) { Alert.alert("Error", error.message); return; }
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    setAllNotifications((prev) => prev.filter((x) => x.id !== n.id));
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
  }

  async function declineFriendRequest(n: Notification) {
    if (!n.related_user_id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("friends").delete().eq("requester_id", n.related_user_id).eq("receiver_id", user.id).eq("status", "pending");
    if (error) { Alert.alert("Error", error.message); return; }
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    setAllNotifications((prev) => prev.filter((x) => x.id !== n.id));
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchGames(), fetchJoined(), fetchUpcoming(), fetchNotifications(), fetchAllNotifications()]);
    setRefreshing(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    fetchGames();
    fetchJoined();
    fetchUpcoming();
    fetchNotifications();
    fetchAllNotifications();

    const channel = supabase.channel("games-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => { fetchGames(); fetchUpcoming(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_participants" }, () => { fetchGames(); fetchJoined(); fetchUpcoming(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => { fetchNotifications(); fetchAllNotifications(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGames, fetchJoined, fetchUpcoming, fetchNotifications, fetchAllNotifications]);

  async function openGame(game: Game) {
    setSelectedGame(game);
    setLoadingParticipants(true);
    const { data: rows } = await supabase.from("game_participants").select("user_name, user_id").eq("game_id", game.id);
    if (!rows || rows.length === 0) { setParticipants([]); setLoadingParticipants(false); return; }
    const userIds = rows.map((r) => r.user_id).filter(Boolean);
    let profileMap: Record<string, { username: string; avatar_url: string | null; sports_interests: string[] }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url, sports_interests").in("id", userIds);
      if (profiles) profiles.forEach((p) => { profileMap[p.id] = p; });
    }
    setParticipants(rows.map((r) => {
      const profile = r.user_id ? profileMap[r.user_id] : null;
      return { user_name: r.user_name, profile_id: r.user_id ?? null, username: profile?.username ?? null, avatar_url: profile?.avatar_url ?? null, sports_interests: profile?.sports_interests ?? null };
    }));
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
    const { error } = await supabase.from("reviews").insert({ profile_id: selectedProfile.id, reviewer_name: user.email?.split("@")[0] ?? "Anonymous", comment: reviewText.trim() });
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
    const { error } = await supabase.from("game_participants").insert({ game_id: game.id, user_name: user.email, user_id: user.id });
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => new Set(prev).add(game.id));
    fetchGames();
    fetchUpcoming();
  }

  async function leaveGame(game: Game) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("game_participants").delete().eq("game_id", game.id).eq("user_name", user.email);
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => { const next = new Set(prev); next.delete(game.id); return next; });
    fetchGames();
    fetchUpcoming();
  }

  function deleteGame(game: Game) {
    Alert.alert("Delete game?", "This will permanently remove the game for all players.", [
      { text: "Keep it", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
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

  function formatDate(isoString: string) {
    return new Date(isoString).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const filtered = filter === "All" ? games : games.filter((g) => g.sport === filter);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.appName}>NTU Sports</Text>
          <View style={styles.headerRight}>
            <Pressable style={styles.notifBtn} onPress={() => { fetchAllNotifications(); setShowMailbox(true); }}>
              <Text style={styles.notifIcon}>📬</Text>
              {notifications.length > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{notifications.length}</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>live</Text>
            </View>
          </View>
        </View>
        <Text style={styles.sub}>Find and join pickup games around campus</Text>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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

              {upcomingGames.length > 0 && (
                <View style={styles.upcomingSection}>
                  <Pressable style={styles.upcomingHeader} onPress={() => setShowUpcoming(!showUpcoming)}>
                    <Text style={styles.upcomingTitle}>📅 Your Upcoming Games ({upcomingGames.length})</Text>
                    <Text style={styles.upcomingChevron}>{showUpcoming ? "▲" : "▼"}</Text>
                  </Pressable>
                  {showUpcoming && upcomingGames.map((game) => (
                    <Pressable key={game.id} style={styles.upcomingCard} onPress={() => openGame(game)}>
                      <View style={styles.upcomingCardLeft}>
                        <Text style={styles.upcomingSport}>{game.sport}</Text>
                        <Text style={styles.upcomingLocation}>{game.location}</Text>
                        <Text style={styles.upcomingTime}>{formatDate(game.start_time)}</Text>
                      </View>
                      <View style={styles.upcomingSlots}>
                        <Text style={styles.upcomingSlotsText}>{game.current_players}/{game.max_players}</Text>
                        <Text style={styles.upcomingSlotsLabel}>players</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

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
                onCancel={item.created_by === currentUserId ? deleteGame : undefined}
              />
            </Pressable>
          )}
          contentContainerStyle={styles.list}
        />
      </View>

      <CreateGameModal visible={modalVisible} onClose={() => setModalVisible(false)} onCreated={() => { fetchGames(); fetchUpcoming(); }} />

      {/* Popup for new notifications */}
      <Modal visible={showNotifModal} animationType="fade" transparent>
        <View style={styles.notifOverlay}>
          <View style={styles.notifModal}>
            <Text style={styles.notifModalTitle}>🔔 New Notifications</Text>
            {notifications.map((n) => (
              <View key={n.id} style={styles.notifItem}>
                <Text style={styles.notifMessage}>{n.message}</Text>
                <Text style={styles.notifTime}>{new Date(n.created_at).toLocaleDateString()}</Text>
                {n.type === "friend_request" && (
                  <View style={styles.friendReqBtns}>
                    <Pressable style={styles.acceptFriendBtn} onPress={() => acceptFriendRequest(n)}>
                      <Text style={styles.acceptFriendBtnText}>Accept</Text>
                    </Pressable>
                    <Pressable style={styles.declineFriendBtn} onPress={() => declineFriendRequest(n)}>
                      <Text style={styles.declineFriendBtnText}>Decline</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
            <Pressable style={styles.notifDismissBtn} onPress={markNotificationsRead}>
              <Text style={styles.notifDismissText}>Dismiss all</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Mailbox Modal */}
      <Modal visible={showMailbox} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📬 Mailbox</Text>
            <Pressable onPress={() => setShowMailbox(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={allNotifications}
            keyExtractor={(n) => n.id}
            contentContainerStyle={styles.modalContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet.</Text>}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchAllNotifications(); setRefreshing(false); }} />
            }
            renderItem={({ item: n }) => (
              <View style={[styles.mailboxItem, n.is_read && styles.mailboxItemRead]}>
                <View style={styles.mailboxItemRow}>
                  <Text style={styles.mailboxDot}>{n.is_read ? "○" : "●"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifMessage, n.is_read && styles.notifMessageRead]}>{n.message}</Text>
                    <Text style={styles.notifTime}>{formatDate(n.created_at)}</Text>
                    {n.type === "friend_request" && !n.is_read && (
                      <View style={styles.friendReqBtns}>
                        <Pressable style={styles.acceptFriendBtn} onPress={() => acceptFriendRequest(n)}>
                          <Text style={styles.acceptFriendBtnText}>Accept</Text>
                        </Pressable>
                        <Pressable style={styles.declineFriendBtn} onPress={() => declineFriendRequest(n)}>
                          <Text style={styles.declineFriendBtnText}>Decline</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
          {allNotifications.some((n) => !n.is_read) && (
            <View style={styles.mailboxFooter}>
              <Pressable style={styles.markAllReadBtn} onPress={markAllRead}>
                <Text style={styles.markAllReadText}>Mark all as read</Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Game Detail Modal */}
      <Modal visible={selectedGame !== null} animationType="slide" presentationStyle="pageSheet"
        onDismiss={() => { setProfileInDetail(null); setProfileInDetailReviews([]); }}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            {profileInDetail ? (
              <Pressable onPress={() => { setProfileInDetail(null); setProfileInDetailReviews([]); }} style={styles.backBtn}>
                <Text style={styles.backBtnText}>‹ Players</Text>
              </Pressable>
            ) : (
              <Text style={styles.modalTitle}>{selectedGame?.sport} · {selectedGame?.location}</Text>
            )}
            <Pressable onPress={() => { setSelectedGame(null); setParticipants([]); setProfileInDetail(null); setProfileInDetailReviews([]); }}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          {profileInDetail ? (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.profileHeader}>
                {profileInDetail.avatar_url ? (
                  <Image source={{ uri: profileInDetail.avatar_url }} style={styles.profileAvatar} />
                ) : (
                  <View style={styles.profileAvatarPlaceholder}>
                    <Text style={styles.profileAvatarText}>{profileInDetail.username[0].toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.profileUsername}>{profileInDetail.username}</Text>
              </View>
              <Text style={styles.sectionLabel}>Sports Interests</Text>
              <View style={styles.sportsRow}>
                {profileInDetail.sports_interests.length > 0 ? (
                  profileInDetail.sports_interests.map((s) => (
                    <View key={s} style={styles.sportChip}><Text style={styles.sportChipText}>{s}</Text></View>
                  ))
                ) : (
                  <Text style={styles.noSportsText}>No sports interests listed.</Text>
                )}
              </View>
              <Text style={styles.sectionLabel}>Reviews ({profileInDetailReviews.length})</Text>
              {profileInDetailReviews.length === 0 ? (
                <Text style={styles.emptyText}>No reviews yet.</Text>
              ) : (
                profileInDetailReviews.map((r) => (
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
          ) : (
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
                    onPress={async () => {
                      if (!p.profile_id) return;
                      const profile = { id: p.profile_id, username: p.username ?? p.user_name, avatar_url: p.avatar_url ?? null, sports_interests: p.sports_interests ?? [] };
                      setProfileInDetail(profile);
                      const { data } = await supabase.from("reviews").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false });
                      setProfileInDetailReviews(data ?? []);
                    }}
                  >
                    {p.avatar_url ? (
                      <Image source={{ uri: p.avatar_url }} style={styles.participantAvatar} />
                    ) : (
                      <View style={styles.participantAvatarPlaceholder}>
                        <Text style={styles.participantAvatarText}>{(p.username ?? p.user_name)[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.participantInfo}>
                      <View style={styles.participantNameRow}>
                        <Text style={styles.participantName}>{p.username ?? p.user_name}</Text>
                        {p.profile_id === selectedGame?.created_by && (
                          <Text style={styles.creatorBadge}>Host</Text>
                        )}
                      </View>
                      {p.sports_interests && p.sports_interests.length > 0 && (
                        <Text style={styles.participantSports} numberOfLines={1}>{p.sports_interests.join(" · ")}</Text>
                      )}
                    </View>
                    {p.profile_id && <Text style={styles.participantArrow}>›</Text>}
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
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
                  <Text style={styles.profileAvatarText}>{(selectedProfile?.username ?? "?")[0].toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.profileUsername}>{selectedProfile?.username}</Text>
            </View>
            <Text style={styles.sectionLabel}>Sports Interests</Text>
            <View style={styles.sportsRow}>
              {(selectedProfile?.sports_interests ?? []).length > 0 ? (
                selectedProfile?.sports_interests.map((sport) => (
                  <View key={sport} style={styles.sportChip}><Text style={styles.sportChipText}>{sport}</Text></View>
                ))
              ) : (
                <Text style={styles.noSportsText}>No sports interests listed.</Text>
              )}
            </View>
            <Text style={styles.sectionLabel}>Leave a Review</Text>
            <View style={styles.reviewInputRow}>
              <TextInput style={styles.reviewInput} placeholder="Write a comment..." value={reviewText} onChangeText={setReviewText} multiline />
              <Pressable style={[styles.reviewSubmitBtn, !reviewText.trim() && styles.reviewSubmitBtnDisabled]} onPress={submitReview} disabled={submittingReview || !reviewText.trim()}>
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  notifBtn: { position: "relative" },
  notifIcon: { fontSize: 22 },
  notifBadge: { position: "absolute", top: -4, right: -4, backgroundColor: "#e53935", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" },
  notifBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
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
  upcomingSection: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e0e0e0", marginBottom: 20, overflow: "hidden" },
  upcomingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  upcomingTitle: { fontSize: 14, fontWeight: "600", color: "#212121" },
  upcomingChevron: { fontSize: 12, color: "#9e9e9e" },
  upcomingCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f5f5f5" },
  upcomingCardLeft: { flex: 1 },
  upcomingSport: { fontSize: 14, fontWeight: "600", color: "#212121", marginBottom: 2 },
  upcomingLocation: { fontSize: 12, color: "#757575", marginBottom: 2 },
  upcomingTime: { fontSize: 11, color: "#9e9e9e" },
  upcomingSlots: { alignItems: "center" },
  upcomingSlotsText: { fontSize: 16, fontWeight: "700", color: "#212121" },
  upcomingSlotsLabel: { fontSize: 10, color: "#9e9e9e" },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase", color: "#bdbdbd", marginBottom: 12, marginTop: 20 },
  list: { paddingBottom: 40 },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyText: { fontSize: 14, color: "#bdbdbd", textAlign: "center", lineHeight: 22 },
  notifOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  notifModal: { backgroundColor: "#fff", borderRadius: 16, padding: 24, width: "100%" },
  notifModalTitle: { fontSize: 18, fontWeight: "700", color: "#212121", marginBottom: 16 },
  notifItem: { backgroundColor: "#fff3e0", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#ffe0b2" },
  notifMessage: { fontSize: 13, color: "#212121", lineHeight: 20, marginBottom: 4 },
  notifMessageRead: { color: "#9e9e9e" },
  notifTime: { fontSize: 11, color: "#9e9e9e" },
  notifDismissBtn: { backgroundColor: "#212121", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  notifDismissText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  mailboxItem: { backgroundColor: "#fff3e0", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#ffe0b2" },
  mailboxItemRead: { backgroundColor: "#fafafa", borderColor: "#f0f0f0" },
  mailboxItemRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  mailboxDot: { fontSize: 12, color: "#e53935", marginTop: 2 },
  friendReqBtns: { flexDirection: "row", gap: 8, marginTop: 10 },
  acceptFriendBtn: { flex: 1, backgroundColor: "#212121", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  acceptFriendBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  declineFriendBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#e0e0e0" },
  declineFriendBtnText: { color: "#757575", fontWeight: "600", fontSize: 13 },
  mailboxFooter: { padding: 20, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  markAllReadBtn: { backgroundColor: "#212121", borderRadius: 10, padding: 14, alignItems: "center" },
  markAllReadText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  modalSafe: { flex: 1, backgroundColor: "#fafafa" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#212121", flex: 1, marginRight: 8 },
  modalClose: { fontSize: 16, color: "#9e9e9e" },
  backBtn: { flex: 1, marginRight: 8 },
  backBtnText: { fontSize: 16, color: "#212121", fontWeight: "500" },
  modalContent: { padding: 20, paddingBottom: 48 },
  gameInfoRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 8 },
  gameInfoText: { fontSize: 13, color: "#757575" },
  participantCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0", padding: 12, marginBottom: 10 },
  participantAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  participantAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#212121", alignItems: "center", justifyContent: "center", marginRight: 12 },
  participantAvatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  participantInfo: { flex: 1 },
  participantNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  participantName: { fontSize: 15, fontWeight: "600", color: "#212121" },
  creatorBadge: { fontSize: 11, fontWeight: "600", color: "#1565c0", backgroundColor: "#e3f2fd", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
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