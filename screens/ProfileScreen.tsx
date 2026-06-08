import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, Modal,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator, Image, FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import { SPORTS } from "../lib/types";

const SPORT_OPTIONS = SPORTS.filter((s) => s !== "All");

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  sports_interests: string[];
  recently_abandoned_at?: string | null;
};

type Review = {
  id: string;
  reviewer_name: string;
  comment: string;
  created_at: string;
};

type Game = {
  id: string;
  sport: string;
  location: string;
  start_time: string;
  skill_level: string | null;
  max_players: number;
  current_players: number;
};

type Rating = {
  id: string;
  rater_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
};

type ModalType = "joined" | "created" | "friends" | null;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [gamesJoined, setGamesJoined] = useState(0);
  const [gamesCreated, setGamesCreated] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [joinedGames, setJoinedGames] = useState<Game[]>([]);
  const [createdGames, setCreatedGames] = useState<Game[]>([]);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [showReviews, setShowReviews] = useState(false);
  const [showFriendReviews, setShowFriendReviews] = useState(false);
  const [ownRatings, setOwnRatings] = useState<Rating[]>([]);
  const [friendRatings, setFriendRatings] = useState<Rating[]>([]);
  const [myRatingForFriend, setMyRatingForFriend] = useState<Rating | null>(null);
  const [canRateFriend, setCanRateFriend] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [recentlyAbandoned, setRecentlyAbandoned] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Friend profile view state
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [friendReviews, setFriendReviews] = useState<Review[]>([]);
  const [friendUpcomingGames, setFriendUpcomingGames] = useState<Game[]>([]);
  const [loadingFriend, setLoadingFriend] = useState(false);
  const [friendReviewText, setFriendReviewText] = useState("");
  const [submittingFriendReview, setSubmittingFriendReview] = useState(false);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setProfile(data);
      setUsername(data.username ?? "");
      setSelectedSports(data.sports_interests ?? []);
      setAvatarUri(data.avatar_url ?? null);
      setRecentlyAbandoned(!!data.recently_abandoned_at);
    } else {
      const newProfile = { id: user.id, username: user.email?.split("@")[0] ?? "Player", sports_interests: [], avatar_url: null };
      await supabase.from("profiles").insert(newProfile);
      setProfile({ ...newProfile });
      setUsername(newProfile.username);
    }
    setLoading(false);
  }, []);

  const fetchReviews = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("reviews").select("*").eq("profile_id", user.id).order("created_at", { ascending: false });
    if (data) setReviews(data);
  }, []);

  const fetchStats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: participations } = await supabase.from("game_participants").select("game_id").eq("user_name", user.email);
    if (participations && participations.length > 0) {
      const gameIds = participations.map((p) => p.game_id);
      const { data: games } = await supabase.from("games_with_counts").select("*").in("id", gameIds).order("start_time", { ascending: false });
      if (games) { setJoinedGames(games); setGamesJoined(games.length); }
    } else { setGamesJoined(0); }
    const { data: created } = await supabase.from("games_with_counts").select("*").eq("created_by", user.id).order("start_time", { ascending: false });
    if (created) { setCreatedGames(created); setGamesCreated(created.length); }
  }, []);

  const fetchFriends = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rows } = await supabase.from("friends").select("requester_id, receiver_id").eq("status", "accepted").or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (!rows || rows.length === 0) { setFriends([]); return; }
    const ids = rows.map((r) => r.requester_id === user.id ? r.receiver_id : r.requester_id);
    const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url, sports_interests, recently_abandoned_at").in("id", ids);
    if (profiles) setFriends(profiles);
  }, []);

  const fetchOwnRatings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("ratings").select("*").eq("rated_id", user.id).order("created_at", { ascending: false });
    if (data) setOwnRatings(data);
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchReviews();
    fetchStats();
    fetchFriends();
    fetchOwnRatings();
  }, [fetchProfile, fetchReviews, fetchStats, fetchFriends, fetchOwnRatings]);

  async function openFriendProfile(friend: Profile) {
    setLoadingFriend(true);
    setSelectedFriend(friend);
    setFriendRatings([]);
    setMyRatingForFriend(null);
    setCanRateFriend(false);
    setRatingStars(0);
    setRatingComment("");

    const { data: { user } } = await supabase.auth.getUser();

    const [reviewsRes, ratingsRes] = await Promise.all([
      supabase.from("reviews").select("*").eq("profile_id", friend.id).order("created_at", { ascending: false }),
      supabase.from("ratings").select("*").eq("rated_id", friend.id).order("created_at", { ascending: false }),
    ]);
    if (reviewsRes.data) setFriendReviews(reviewsRes.data);
    if (ratingsRes.data) {
      setFriendRatings(ratingsRes.data);
      if (user) {
        const mine = ratingsRes.data.find((r) => r.rater_id === user.id) ?? null;
        setMyRatingForFriend(mine);
        if (mine) { setRatingStars(mine.stars); setRatingComment(mine.comment ?? ""); }
      }
    }

    const { data: participations } = await supabase.from("game_participants").select("game_id").eq("user_name", friend.username);
    if (participations && participations.length > 0) {
      const ids = participations.map((p) => p.game_id);
      const { data: games } = await supabase.from("games_with_counts").select("*").in("id", ids).eq("status", "open").gte("start_time", new Date().toISOString()).order("start_time", { ascending: true });
      if (games) setFriendUpcomingGames(games);

      if (user) {
        const { data: myParts } = await supabase.from("game_participants").select("game_id").eq("user_id", user.id);
        if (myParts && myParts.length > 0) {
          const myIds = myParts.map((p) => p.game_id);
          const { data: friendParts } = await supabase.from("game_participants").select("game_id").eq("user_id", friend.id).in("game_id", myIds);
          if (friendParts && friendParts.length > 0) {
            const sharedIds = friendParts.map((p) => p.game_id);
            const { data: completed } = await supabase.from("games").select("id").in("id", sharedIds).lte("start_time", new Date().toISOString()).limit(1);
            setCanRateFriend((completed?.length ?? 0) > 0);
          }
        }
      }
    } else {
      setFriendUpcomingGames([]);
    }
    setLoadingFriend(false);
  }

  function confirmRemoveFriend(friend: Profile) {
    Alert.alert("Remove friend?", `Remove ${friend.username} from your friends?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeFriend(friend) },
    ]);
  }

  async function removeFriend(friend: Profile) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("friends")
      .delete()
      .or(`and(requester_id.eq.${user.id},receiver_id.eq.${friend.id}),and(requester_id.eq.${friend.id},receiver_id.eq.${user.id})`)
      .eq("status", "accepted");
    if (error) { Alert.alert("Error", error.message); return; }
    setFriends((prev) => prev.filter((f) => f.id !== friend.id));
    setSelectedFriend(null);
    setFriendReviews([]);
    setFriendUpcomingGames([]);
    setFriendReviewText("");
  }

  async function submitRating() {
    if (ratingStars === 0 || !selectedFriend) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubmittingRating(true);
    const payload = { rater_id: user.id, rated_id: selectedFriend.id, stars: ratingStars, comment: ratingComment.trim() || null };
    const { data, error } = myRatingForFriend
      ? await supabase.from("ratings").update({ stars: ratingStars, comment: ratingComment.trim() || null }).eq("id", myRatingForFriend.id).select().single()
      : await supabase.from("ratings").insert(payload).select().single();
    setSubmittingRating(false);
    if (error) { Alert.alert("Error", error.message); return; }
    if (data) setMyRatingForFriend(data);
    const { data: updated } = await supabase.from("ratings").select("*").eq("rated_id", selectedFriend.id).order("created_at", { ascending: false });
    if (updated) setFriendRatings(updated);
  }

  async function submitFriendReview() {
    if (!friendReviewText.trim() || !selectedFriend) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubmittingFriendReview(true);
    const { error } = await supabase.from("reviews").insert({ profile_id: selectedFriend.id, reviewer_name: profile?.username ?? user.email?.split("@")[0] ?? "Anonymous", comment: friendReviewText.trim() });
    setSubmittingFriendReview(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setFriendReviewText("");
    const { data } = await supabase.from("reviews").select("*").eq("profile_id", selectedFriend.id).order("created_at", { ascending: false });
    if (data) setFriendReviews(data);
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Please allow access to your photo library."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const filePath = `avatars/${user.id}.jpg`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, decode(asset.base64), { contentType: "image/jpeg", upsert: true });
    if (uploadError) { Alert.alert("Upload failed", uploadError.message); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    if (updateError) { Alert.alert("Save failed", updateError.message); return; }
    setAvatarUri(publicUrl);
    setProfile((prev) => prev ? { ...prev, avatar_url: publicUrl } : prev);
  }

  function decode(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function changePassword() {
    if (newPassword.length < 6) { Alert.alert("Too short", "Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { Alert.alert("Mismatch", "Passwords do not match."); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { Alert.alert("Error", error.message); return; }
    Alert.alert("Done", "Your password has been updated.");
    setNewPassword("");
    setConfirmPassword("");
    setShowChangePassword(false);
  }

  async function saveProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ username, sports_interests: selectedSports }).eq("id", user.id);
    if (error) { Alert.alert("Error", error.message); return; }
    setProfile((prev) => prev ? { ...prev, username, sports_interests: selectedSports } : prev);
    setEditing(false);
  }

  async function submitReview() {
    if (!reviewText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profile) return;
    if (user.id === profile.id) { Alert.alert("Not allowed", "You cannot review yourself."); return; }
    setSubmittingReview(true);
    const { error } = await supabase.from("reviews").insert({ profile_id: profile.id, reviewer_name: profile?.username ?? user.email?.split("@")[0] ?? "Anonymous", comment: reviewText.trim() });
    setSubmittingReview(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setReviewText("");
    fetchReviews();
  }

  function toggleSport(sport: string) {
    setSelectedSports((prev) => prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]);
  }

  function formatTime(isoString: string) {
    const diff = new Date(isoString).getTime() - Date.now();
    const mins = Math.round(diff / 60000);
    if (mins < 0) return "ended";
    if (mins < 60) return `in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  }

  function formatDate(isoString: string) {
    return new Date(isoString).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function renderStars(count: number, size = 16) {
    return (
      <View style={{ flexDirection: "row", gap: 2 }}>
        {[1, 2, 3, 4].map((s) => (
          <Text key={s} style={{ fontSize: size, color: s <= count ? "#f59e0b" : "#e0e0e0" }}>★</Text>
        ))}
      </View>
    );
  }

  function avgStars(ratings: Rating[]) {
    if (ratings.length === 0) return null;
    return (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1);
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const isOwnProfile = currentUserId === profile?.id;

  function renderGameCard(game: Game) {
    return (
      <View key={game.id} style={styles.gameCard}>
        <View style={styles.gameCardTop}>
          <Text style={styles.gameCardSport}>{game.sport}</Text>
          <Text style={styles.gameCardTime}>{formatTime(game.start_time)}</Text>
        </View>
        <Text style={styles.gameCardLocation}>{game.location}</Text>
        <Text style={styles.gameCardMeta}>{game.current_players}/{game.max_players} players · {game.skill_level}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Pressable onPress={editing ? pickImage : undefined} style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(profile?.username ?? "?")[0].toUpperCase()}</Text>
              </View>
            )}
            {editing && (
              <View style={styles.avatarOverlay}>
                <Text style={styles.avatarOverlayText}>📷</Text>
              </View>
            )}
          </Pressable>
          {editing ? (
            <TextInput style={styles.usernameInput} value={username} onChangeText={setUsername} autoFocus />
          ) : (
            <>
              <View style={styles.usernameRow}>
                <Text style={styles.username}>{profile?.username}</Text>
                <Text style={styles.usernameRating}>
                  {ownRatings.length > 0 ? `★ ${avgStars(ownRatings)}/4` : "★ —/4"}
                </Text>
              </View>
              {recentlyAbandoned && (
                <View style={styles.abandonedBadge}>
                  <Text style={styles.abandonedBadgeText}>Recently Abandoned</Text>
                </View>
              )}
            </>
          )}
          {isOwnProfile && (
            <Pressable style={styles.editBtn} onPress={editing ? saveProfile : () => setEditing(true)}>
              <Text style={styles.editBtnText}>{editing ? "Save" : "Edit profile"}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.statsRow}>
          <Pressable style={styles.statBox} onPress={() => setActiveModal("joined")}>
            <Text style={styles.statNum}>{gamesJoined}</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.statBox} onPress={() => setActiveModal("created")}>
            <Text style={styles.statNum}>{gamesCreated}</Text>
            <Text style={styles.statLabel}>Created</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{reviews.length}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <Pressable style={styles.statBox} onPress={() => setActiveModal("friends")}>
            <Text style={styles.statNum}>{friends.length}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Sports Interests</Text>
        {editing ? (
          <>
            <Text style={styles.editHint}>Tap to select your interests</Text>
            <View style={styles.sportsRow}>
              {SPORT_OPTIONS.map((sport) => {
                const active = selectedSports.includes(sport);
                return (
                  <Pressable key={sport} style={[styles.sportChip, active && styles.sportChipActive]} onPress={() => toggleSport(sport)}>
                    <Text style={[styles.sportChipText, active && styles.sportChipTextActive]}>{sport}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.sportsRow}>
            {(profile?.sports_interests ?? []).length > 0 ? (
              profile?.sports_interests.map((sport) => (
                <View key={sport} style={styles.sportChipActive}>
                  <Text style={styles.sportChipTextActive}>{sport}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noSportsText}>
                No sports interests indicated.{isOwnProfile ? " Tap Edit profile to add some!" : ""}
              </Text>
            )}
          </View>
        )}

        {!isOwnProfile && (
          <>
            <Text style={styles.sectionLabel}>Leave a Review</Text>
            <View style={styles.reviewInputRow}>
              <TextInput style={styles.reviewInput} placeholder="Write a comment..." value={reviewText} onChangeText={setReviewText} multiline />
              <Pressable style={[styles.reviewSubmitBtn, !reviewText.trim() && styles.reviewSubmitBtnDisabled]} onPress={submitReview} disabled={submittingReview || !reviewText.trim()}>
                <Text style={styles.reviewSubmitText}>Post</Text>
              </Pressable>
            </View>
          </>
        )}

        <Pressable style={styles.collapsibleHeader} onPress={() => setShowReviews((v) => !v)}>
          <Text style={styles.sectionLabel}>Reviews ({reviews.length})</Text>
          <Text style={styles.chevron}>{showReviews ? "▲" : "▼"}</Text>
        </Pressable>
        {showReviews && (
          reviews.length === 0 ? (
            <Text style={styles.emptyText}>No reviews yet.</Text>
          ) : (
            reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{r.reviewer_name}</Text>
                  <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.reviewComment}>{r.comment}</Text>
              </View>
            ))
          )
        )}

        <Pressable style={styles.signOutBtn} onPress={() => Alert.alert("For real?", "", [{ text: "No", style: "cancel" }, { text: "Yes", style: "destructive", onPress: () => supabase.auth.signOut() }])}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsChangePasswordText}>Settings</Text>
        </Pressable>
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Pressable onPress={() => setShowSettings(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.settingsCard}>
            <Pressable style={styles.settingsRow} onPress={() => { setShowSettings(false); setTimeout(() => setShowChangePassword(true), 300); }}>
              <Text style={styles.settingsRowLabel}>Change password</Text>
              <Text style={styles.settingsRowArrow}>›</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showChangePassword} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Pressable onPress={() => { setShowChangePassword(false); setNewPassword(""); setConfirmPassword(""); }}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            <Text style={styles.pwLabel}>New password</Text>
            <TextInput
              style={styles.pwInput}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor="#bdbdbd"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.pwLabel}>Confirm new password</Text>
            <TextInput
              style={styles.pwInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Re-enter new password"
              placeholderTextColor="#bdbdbd"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[styles.pwSaveBtn, (changingPassword || !newPassword || !confirmPassword) && styles.pwSaveBtnDisabled]}
              onPress={changePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}
            >
              <Text style={styles.pwSaveBtnText}>{changingPassword ? "Saving..." : "Save password"}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Games / Friends Modal */}
      <Modal visible={activeModal !== null && selectedFriend === null} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {activeModal === "joined" ? "Games Joined" : activeModal === "created" ? "Games Created" : "Friends"}
            </Text>
            <Pressable onPress={() => setActiveModal(null)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          {activeModal === "joined" && (
            <FlatList data={joinedGames} keyExtractor={(g) => g.id} contentContainerStyle={styles.modalList}
              ListEmptyComponent={<Text style={styles.emptyText}>No games joined yet.</Text>}
              renderItem={({ item }) => renderGameCard(item)} />
          )}

          {activeModal === "created" && (
            <FlatList data={createdGames} keyExtractor={(g) => g.id} contentContainerStyle={styles.modalList}
              ListEmptyComponent={<Text style={styles.emptyText}>No games created yet.</Text>}
              renderItem={({ item }) => renderGameCard(item)} />
          )}

          {activeModal === "friends" && (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              contentContainerStyle={styles.modalList}
              ListEmptyComponent={<Text style={styles.emptyText}>No friends yet. Find players in the Search tab!</Text>}
              renderItem={({ item: f }) => (
                <Pressable style={styles.friendCard} onPress={() => openFriendProfile(f)}>
                  {f.avatar_url ? (
                    <Image source={{ uri: f.avatar_url }} style={styles.friendAvatar} />
                  ) : (
                    <View style={styles.friendAvatarPlaceholder}>
                      <Text style={styles.friendAvatarText}>{f.username[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendUsername}>{f.username}</Text>
                    {f.sports_interests.length > 0 && (
                      <Text style={styles.friendSports} numberOfLines={1}>{f.sports_interests.join(" · ")}</Text>
                    )}
                  </View>
                  <Text style={styles.friendArrow}>›</Text>
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Friend Profile Modal */}
      <Modal visible={selectedFriend !== null} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => { setSelectedFriend(null); setFriendReviews([]); setFriendRatings([]); setFriendUpcomingGames([]); setFriendReviewText(""); setShowFriendReviews(false); setRatingStars(0); setRatingComment(""); }} style={{ flex: 1 }}>
              <Text style={styles.backBtnText}>‹ Friends</Text>
            </Pressable>
            <Pressable onPress={() => { setSelectedFriend(null); setActiveModal(null); setFriendReviews([]); setFriendRatings([]); setFriendUpcomingGames([]); setFriendReviewText(""); setShowFriendReviews(false); setRatingStars(0); setRatingComment(""); }}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          {loadingFriend ? (
            <ActivityIndicator style={{ flex: 1 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.modalList}>
              <View style={styles.friendProfileHeader}>
                {selectedFriend?.avatar_url ? (
                  <Image source={{ uri: selectedFriend.avatar_url }} style={styles.friendProfileAvatar} />
                ) : (
                  <View style={styles.friendProfileAvatarPlaceholder}>
                    <Text style={styles.friendProfileAvatarText}>{(selectedFriend?.username ?? "?")[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.usernameRow}>
                  <Text style={styles.friendProfileUsername}>{selectedFriend?.username}</Text>
                  <Text style={styles.usernameRating}>
                    {friendRatings.length > 0 ? `★ ${avgStars(friendRatings)}/4` : "★ —/4"}
                  </Text>
                </View>
                {selectedFriend?.recently_abandoned_at && (
                  <View style={styles.abandonedBadge}>
                    <Text style={styles.abandonedBadgeText}>Recently Abandoned</Text>
                  </View>
                )}
                {selectedFriend && (
                  <Pressable style={styles.removeFriendBtn} onPress={() => confirmRemoveFriend(selectedFriend)}>
                    <Text style={styles.removeFriendBtnText}>Remove friend</Text>
                  </Pressable>
                )}
              </View>

              <Text style={styles.sectionLabel}>Sports Interests</Text>
              <View style={styles.sportsRow}>
                {(selectedFriend?.sports_interests ?? []).length > 0 ? (
                  selectedFriend?.sports_interests.map((sport) => (
                    <View key={sport} style={styles.sportChipActive}>
                      <Text style={styles.sportChipTextActive}>{sport}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noSportsText}>No sports interests listed.</Text>
                )}
              </View>

              <Text style={styles.sectionLabel}>Upcoming Games ({friendUpcomingGames.length})</Text>
              {friendUpcomingGames.length === 0 ? (
                <Text style={styles.emptyText}>No upcoming games.</Text>
              ) : (
                friendUpcomingGames.map((game) => (
                  <View key={game.id} style={styles.gameCard}>
                    <View style={styles.gameCardTop}>
                      <Text style={styles.gameCardSport}>{game.sport}</Text>
                      <Text style={styles.gameCardTime}>{formatTime(game.start_time)}</Text>
                    </View>
                    <Text style={styles.gameCardLocation}>{game.location}</Text>
                    <Text style={styles.gameCardDate}>{formatDate(game.start_time)}</Text>
                    <Text style={styles.gameCardMeta}>{game.current_players}/{game.max_players} players · {game.skill_level}</Text>
                  </View>
                ))
              )}

              {canRateFriend && (
                <>
                  <Text style={styles.sectionLabel}>{myRatingForFriend ? "Your Rating" : "To Be Rated"}</Text>
                  <View style={styles.starSelector}>
                    {[1, 2, 3, 4].map((s) => (
                      <Pressable key={s} onPress={() => setRatingStars(s)}>
                        <Text style={[styles.starBtn, { color: s <= ratingStars ? "#f59e0b" : "#e0e0e0" }]}>★</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.reviewInputRow}>
                    <TextInput style={styles.reviewInput} placeholder="Write a review (optional)..." value={ratingComment} onChangeText={setRatingComment} multiline />
                    <Pressable style={[styles.reviewSubmitBtn, ratingStars === 0 && styles.reviewSubmitBtnDisabled]} onPress={submitRating} disabled={submittingRating || ratingStars === 0}>
                      <Text style={styles.reviewSubmitText}>{myRatingForFriend ? "Update" : "Submit"}</Text>
                    </Pressable>
                  </View>
                </>
              )}

              <Text style={styles.sectionLabel}>Leave a Review</Text>
              <View style={styles.reviewInputRow}>
                <TextInput style={styles.reviewInput} placeholder="Write a comment..." value={friendReviewText} onChangeText={setFriendReviewText} multiline />
                <Pressable style={[styles.reviewSubmitBtn, !friendReviewText.trim() && styles.reviewSubmitBtnDisabled]} onPress={submitFriendReview} disabled={submittingFriendReview || !friendReviewText.trim()}>
                  <Text style={styles.reviewSubmitText}>Post</Text>
                </Pressable>
              </View>

              <Pressable style={styles.collapsibleHeader} onPress={() => setShowFriendReviews((v) => !v)}>
                <Text style={styles.sectionLabel}>Reviews ({friendReviews.length})</Text>
                <Text style={styles.chevron}>{showFriendReviews ? "▲" : "▼"}</Text>
              </Pressable>
              {showFriendReviews && (
                friendReviews.length === 0 ? (
                  <Text style={styles.emptyText}>No reviews yet.</Text>
                ) : (
                  friendReviews.map((r) => (
                    <View key={r.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewerName}>{r.reviewer_name}</Text>
                        <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                      </View>
                      <Text style={styles.reviewComment}>{r.comment}</Text>
                    </View>
                  ))
                )
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fafafa" },
  container: { padding: 20, paddingBottom: 48 },
  header: { alignItems: "center", marginBottom: 24, paddingTop: 8 },
  avatarWrapper: { marginBottom: 12, position: "relative" },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#212121", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  avatarOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  avatarOverlayText: { fontSize: 24 },
  usernameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  username: { fontSize: 20, fontWeight: "700", color: "#212121" },
  usernameRating: { fontSize: 13, fontWeight: "600", color: "#f59e0b" },
  usernameInput: { fontSize: 20, fontWeight: "700", color: "#212121", borderBottomWidth: 2, borderBottomColor: "#212121", marginBottom: 12, minWidth: 150, textAlign: "center" },
  editBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "#212121" },
  editBtnText: { fontSize: 13, fontWeight: "500", color: "#212121" },
  statsRow: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e0e0e0", marginBottom: 24, paddingVertical: 16 },
  statBox: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "700", color: "#212121" },
  statLabel: { fontSize: 11, color: "#9e9e9e", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#e0e0e0" },
  collapsibleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 12 },
  chevron: { fontSize: 11, color: "#bdbdbd" },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: "#bdbdbd", marginBottom: 0, marginTop: 0 },
  sportsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  sportChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#fff" },
  sportChipActive: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#212121", borderWidth: 1, borderColor: "#212121" },
  sportChipText: { fontSize: 13, color: "#757575" },
  sportChipTextActive: { color: "#fff", fontWeight: "600", fontSize: 13 },
  editHint: { fontSize: 12, color: "#9e9e9e", marginBottom: 8 },
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
  emptyText: { fontSize: 13, color: "#bdbdbd", textAlign: "center", marginTop: 16 },
  friendCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0", padding: 12, marginBottom: 10 },
  friendAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  friendAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#212121", alignItems: "center", justifyContent: "center", marginRight: 12 },
  friendAvatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  friendInfo: { flex: 1 },
  friendUsername: { fontSize: 15, fontWeight: "600", color: "#212121", marginBottom: 2 },
  friendSports: { fontSize: 12, color: "#9e9e9e" },
  friendArrow: { fontSize: 20, color: "#bdbdbd" },
  friendProfileHeader: { alignItems: "center", marginBottom: 24, paddingTop: 8 },
  friendProfileAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  friendProfileAvatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#212121", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  friendProfileAvatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  friendProfileUsername: { fontSize: 20, fontWeight: "700", color: "#212121", marginBottom: 10 },
  removeFriendBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#fff" },
  removeFriendBtnText: { fontSize: 13, fontWeight: "600", color: "#e53935" },
  ratingHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  avgStarsText: { fontSize: 13, fontWeight: "600", color: "#f59e0b" },
  ratingCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0", padding: 12, marginBottom: 10 },
  ratingCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  ratingDate: { fontSize: 11, color: "#9e9e9e" },
  ratingComment: { fontSize: 13, color: "#424242", lineHeight: 20 },
  starSelector: { flexDirection: "row", gap: 8, marginBottom: 12 },
  starBtn: { fontSize: 32 },
  backBtnText: { fontSize: 16, color: "#212121", fontWeight: "500" },
  signOutBtn: { marginTop: 32, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0", alignItems: "center", backgroundColor: "#fff" },
  signOutText: { fontSize: 14, fontWeight: "600", color: "#e53935" },
  settingsChangePasswordText: { fontSize: 14, fontWeight: "600", color: "#212121" },
  abandonedBadge: { backgroundColor: "#fff3e0", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "#ff9800", marginTop: 6 },
  abandonedBadgeText: { fontSize: 11, color: "#e65100", fontWeight: "700" },
  settingsCard: { margin: 20, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0", overflow: "hidden" },
  settingsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  settingsRowLabel: { flex: 1, fontSize: 15, color: "#212121" },
  settingsRowArrow: { fontSize: 20, color: "#bdbdbd" },
  pwLabel: { fontSize: 12, fontWeight: "600", color: "#9e9e9e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  pwInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#212121", marginBottom: 20 },
  pwSaveBtn: { marginTop: 8, backgroundColor: "#212121", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  pwSaveBtnDisabled: { backgroundColor: "#bdbdbd" },
  pwSaveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalSafe: { flex: 1, backgroundColor: "#fafafa" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#212121" },
  modalClose: { fontSize: 16, color: "#9e9e9e" },
  modalList: { padding: 20, paddingBottom: 48 },
  gameCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0", padding: 14, marginBottom: 10 },
  gameCardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  gameCardSport: { fontSize: 14, fontWeight: "600", color: "#212121" },
  gameCardTime: { fontSize: 12, color: "#9e9e9e" },
  gameCardLocation: { fontSize: 14, color: "#424242", marginBottom: 2 },
  gameCardDate: { fontSize: 11, color: "#1565c0", marginBottom: 4 },
  gameCardMeta: { fontSize: 12, color: "#9e9e9e" },
});