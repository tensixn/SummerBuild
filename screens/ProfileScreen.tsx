import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, Modal,
  StyleSheet, Alert, ActivityIndicator, Image, FlatList, RefreshControl, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import { SPORTS } from "../lib/types";
import { useTheme, Colors } from "../lib/theme";
import CloseButton from "../components/CloseButton";
import { Switch } from "react-native";

const SPORT_OPTIONS = SPORTS.filter((s) => s !== "All");

const AVATAR_BORDERS = [
  { id: "bronze",    name: "Bronze",    price: 50,  color: "#cd7f32" },
  { id: "silver",    name: "Silver",    price: 100, color: "#a8a8a8" },
  { id: "neon_blue", name: "Neon Blue", price: 150, color: "#00b4ff" },
  { id: "neon_pink", name: "Neon Pink", price: 150, color: "#ff2d78" },
  { id: "emerald",   name: "Emerald",   price: 175, color: "#2ecc71" },
  { id: "gold",      name: "Gold",      price: 200, color: "#ffd700" },
  { id: "ruby",      name: "Ruby",      price: 250, color: "#e74c3c" },
  { id: "diamond",   name: "Diamond",   price: 500, color: "#a8e6f0" },
  { id: "champion",  name: "Champion",  price: 750, color: "#ff6b35" },
];

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
    const d = new Date(sortedWeeks[i - 1]);
    d.setUTCDate(d.getUTCDate() + 7);
    if (sortedWeeks[i] === d.toISOString().split("T")[0]) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run);
  return { current, longest: Math.max(longest, current) };
}

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  sports_interests: string[];
  recently_abandoned_at?: string | null;
  coins?: number;
  equipped_border_id?: string | null;
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
  const { colors, isDark, toggle } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const [abandonedCount, setAbandonedCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [coins, setCoins] = useState(0);
  const [equippedBorderId, setEquippedBorderId] = useState<string | null>(null);
  const [ownedBorderIds, setOwnedBorderIds] = useState<Set<string>>(new Set());
  const [showShop, setShowShop] = useState(false);
  const [purchasingBorder, setPurchasingBorder] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [friendCurrentStreak, setFriendCurrentStreak] = useState(0);
  const [friendLongestStreak, setFriendLongestStreak] = useState(0);

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
      setAbandonedCount(data.abandoned_count ?? 0);
      setCoins(data.coins ?? 0);
      setEquippedBorderId(data.equipped_border_id ?? null);
      const { data: borders } = await supabase.from("user_borders").select("border_id").eq("user_id", user.id);
      if (borders) setOwnedBorderIds(new Set(borders.map((b: any) => b.border_id)));
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
      const gameIds = participations.map((p: any) => p.game_id);
      const { data: games } = await supabase.from("games_with_counts").select("*").in("id", gameIds).order("start_time", { ascending: false });
      if (games) { setJoinedGames(games); setGamesJoined(games.length); }
    } else { setGamesJoined(0); }
    const { data: created } = await supabase.from("games_with_counts").select("*").eq("created_by", user.id).order("start_time", { ascending: false });
    if (created) { setCreatedGames(created); setGamesCreated(created.length); }
    const { data: allParts } = await supabase.from("game_participants").select("game_id").eq("user_id", user.id);
    if (allParts && allParts.length > 0) {
      const allIds = allParts.map((p: any) => p.game_id);
      const { data: closedGames } = await supabase.from("games").select("end_time").in("id", allIds).eq("status", "completed");
      if (closedGames) {
        const dates = closedGames.map((g: any) => g.end_time).filter(Boolean) as string[];
        const { current, longest } = computeStreak(dates);
        setCurrentStreak(current);
        setLongestStreak(longest);
      }
    } else {
      setCurrentStreak(0);
      setLongestStreak(0);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rows } = await supabase.from("friends").select("requester_id, receiver_id").eq("status", "accepted").or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (!rows || rows.length === 0) { setFriends([]); return; }
    const ids = rows.map((r: any) => r.requester_id === user.id ? r.receiver_id : r.requester_id);
    const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url, sports_interests, recently_abandoned_at, equipped_border_id").in("id", ids);
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

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchReviews(), fetchStats(), fetchFriends(), fetchOwnRatings()]);
    setRefreshing(false);
  }

  async function openFriendProfile(friend: Profile) {
    setLoadingFriend(true);
    setSelectedFriend(friend);
    setFriendRatings([]);
    setMyRatingForFriend(null);
    setCanRateFriend(false);
    setRatingStars(0);
    setRatingComment("");
    setFriendCurrentStreak(0);
    setFriendLongestStreak(0);

    const { data: { user } } = await supabase.auth.getUser();

    const [reviewsRes, ratingsRes] = await Promise.all([
      supabase.from("reviews").select("*").eq("profile_id", friend.id).order("created_at", { ascending: false }),
      supabase.from("ratings").select("*").eq("rated_id", friend.id).order("created_at", { ascending: false }),
    ]);
    if (reviewsRes.data) setFriendReviews(reviewsRes.data);
    if (ratingsRes.data) {
      setFriendRatings(ratingsRes.data);
      if (user) {
        const mine = ratingsRes.data.find((r: any) => r.rater_id === user.id) ?? null;
        setMyRatingForFriend(mine);
        if (mine) { setRatingStars(mine.stars); setRatingComment(mine.comment ?? ""); }
      }
    }

    const { data: participations } = await supabase.from("game_participants").select("game_id").eq("user_name", friend.username);
    if (participations && participations.length > 0) {
      const ids = participations.map((p: any) => p.game_id);
      const { data: games } = await supabase.from("games_with_counts").select("*").in("id", ids).eq("status", "open").gte("start_time", new Date().toISOString()).order("start_time", { ascending: true });
      if (games) setFriendUpcomingGames(games);

      if (user) {
        const { data: myParts } = await supabase.from("game_participants").select("game_id").eq("user_id", user.id);
        if (myParts && myParts.length > 0) {
          const myIds = myParts.map((p: any) => p.game_id);
          const { data: friendParts } = await supabase.from("game_participants").select("game_id").eq("user_id", friend.id).in("game_id", myIds);
          if (friendParts && friendParts.length > 0) {
            const sharedIds = friendParts.map((p: any) => p.game_id);
            const { data: completed } = await supabase.from("games").select("id").in("id", sharedIds).lte("start_time", new Date().toISOString()).limit(1);
            setCanRateFriend((completed?.length ?? 0) > 0);
          }
        }
      }
    } else {
      setFriendUpcomingGames([]);
    }
    const { data: friendParts } = await supabase.from("game_participants").select("game_id").eq("user_id", friend.id);
    if (friendParts && friendParts.length > 0) {
      const friendIds = friendParts.map((p: any) => p.game_id);
      const { data: friendClosed } = await supabase.from("games").select("end_time").in("id", friendIds).eq("status", "completed");
      if (friendClosed) {
        const dates = friendClosed.map((g: any) => g.end_time).filter(Boolean) as string[];
        const { current, longest } = computeStreak(dates);
        setFriendCurrentStreak(current);
        setFriendLongestStreak(longest);
      }
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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
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

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Are you sure?",
              "Your profile, reviews, and game history will be deleted forever.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Yes, delete my account", style: "destructive", onPress: deleteAccount },
              ]
            ),
        },
      ]
    );
  }

  async function deleteAccount() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setShowSettings(false);
    const { error } = await supabase.rpc("delete_user");
    if (error) {
      Alert.alert("Error", "Failed to delete account: " + error.message);
      setShowSettings(true);
      return;
    }
    await supabase.auth.signOut();
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

  async function buyBorder(borderId: string, price: number) {
    if (coins < price) { Alert.alert("Not enough coins", `You need ${price - coins} more coins.`); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setPurchasingBorder(true);
    const { error } = await supabase.from("user_borders").insert({ user_id: user.id, border_id: borderId });
    if (!error) {
      await supabase.from("profiles").update({ coins: coins - price }).eq("id", user.id);
      setCoins((c) => c - price);
      setOwnedBorderIds((prev) => new Set([...prev, borderId]));
    }
    setPurchasingBorder(false);
  }

  async function equipBorder(borderId: string | null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ equipped_border_id: borderId }).eq("id", user.id);
    setEquippedBorderId(borderId);
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
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        <View style={styles.header}>
          <Pressable onPress={editing ? pickImage : undefined} style={styles.avatarWrapper}>
            {(() => {
              const border = AVATAR_BORDERS.find(b => b.id === equippedBorderId);
              return (
                <View style={[styles.avatarRing, border ? { borderColor: border.color, borderWidth: 4 } : { borderWidth: 0 }]}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(profile?.username ?? "?")[0].toUpperCase()}</Text>
                    </View>
                  )}
                </View>
              );
            })()}
            {editing && (
              <View style={styles.avatarOverlay}>
                <Text style={styles.avatarOverlayText}>📷</Text>
              </View>
            )}
          </Pressable>
          {editing ? (
            <TextInput style={styles.usernameInput} value={username} onChangeText={setUsername} autoFocus />
          ) : (
            <View style={styles.usernameRow}>
              <Text style={styles.username}>{profile?.username}</Text>
              <Text style={styles.usernameRating}>
                {ownRatings.length > 0 ? `★ ${avgStars(ownRatings)}/4` : "★ —/4"}
              </Text>
              {recentlyAbandoned && (
                <View style={styles.abandonedBadge}>
                  <Text style={styles.abandonedBadgeText}>Recently Abandoned</Text>
                </View>
              )}
            </View>
          )}
          {isOwnProfile && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.coinChip}>
                <Text style={styles.coinChipText}>💰 {coins}</Text>
              </View>
              <Pressable style={styles.editBtn} onPress={editing ? saveProfile : () => setEditing(true)}>
                <Text style={styles.editBtnText}>{editing ? "Save" : "Edit profile"}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.streakCard}>
          <View style={styles.streakItem}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={styles.streakNum}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>Week Streak</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={styles.streakIcon}>🏆</Text>
            <Text style={styles.streakNum}>{longestStreak}</Text>
            <Text style={styles.streakLabel}>Best Streak</Text>
          </View>
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
          <View style={styles.statBox}>
            <Text style={[styles.statNum, abandonedCount > 0 && styles.statNumAbandoned]}>{abandonedCount}</Text>
            <Text style={styles.statLabel}>Abandoned</Text>
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

        <Pressable style={styles.signOutBtn} onPress={() => setShowShop(true)}>
          <Text style={styles.shopBtnText}>🛍 Shop</Text>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsChangePasswordText}>Settings</Text>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={() => Alert.alert("Sign out?", "Are you sure you want to sign out?", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: () => supabase.auth.signOut() }])}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      {/* Shop Modal */}
      <Modal visible={showShop} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🛍 Avatar Borders</Text>
            <View style={styles.coinChip}>
              <Text style={styles.coinChipText}>💰 {coins}</Text>
            </View>
            <CloseButton onPress={() => setShowShop(false)} />
          </View>
          <ScrollView contentContainerStyle={styles.shopScrollContent}>
            {/* Earn coins guide */}
            <View style={styles.earnCard}>
              <Text style={styles.earnTitle}>How to earn coins</Text>
              <View style={styles.earnRow}>
                <Text style={styles.earnIcon}>🏁</Text>
                <Text style={styles.earnDesc}>Finish a game as participant</Text>
                <Text style={styles.earnAmount}>+2</Text>
              </View>
              <View style={styles.earnDivider} />
              <View style={styles.earnRow}>
                <Text style={styles.earnIcon}>🎮</Text>
                <Text style={styles.earnDesc}>Host a game to completion</Text>
                <Text style={styles.earnAmount}>+5</Text>
              </View>
              <View style={styles.earnDivider} />
              <View style={styles.earnRow}>
                <Text style={styles.earnIcon}>⭐</Text>
                <Text style={styles.earnDesc}>Rate a completed game</Text>
                <Text style={styles.earnAmount}>+1</Text>
              </View>
            </View>

            {/* Borders grid */}
            <Text style={styles.shopSectionLabel}>Available Borders</Text>
            <View style={styles.shopGrid}>
            {AVATAR_BORDERS.map((border) => {
              const owned = ownedBorderIds.has(border.id);
              const equipped = equippedBorderId === border.id;
              const canAfford = coins >= border.price;
              return (
                <View key={border.id} style={[styles.borderCard, equipped && styles.borderCardEquipped]}>
                  <View style={[styles.borderPreviewOuter, { borderColor: border.color }]}>
                    <View style={styles.borderPreviewInner} />
                  </View>
                  <Text style={styles.borderName}>{border.name}</Text>
                  <Text style={styles.borderPrice}>💰 {border.price}</Text>
                  {equipped ? (
                    <Pressable style={styles.unequipBtn} onPress={() => equipBorder(null)}>
                      <Text style={styles.unequipBtnText}>Unequip</Text>
                    </Pressable>
                  ) : owned ? (
                    <Pressable style={styles.equipBtn} onPress={() => equipBorder(border.id)}>
                      <Text style={styles.equipBtnText}>Equip</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
                      onPress={() => canAfford && buyBorder(border.id, border.price)}
                      disabled={!canAfford || purchasingBorder}
                    >
                      <Text style={[styles.buyBtnText, !canAfford && styles.buyBtnTextDisabled]}>
                        {canAfford ? "Buy" : `Need ${border.price - coins} more`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <CloseButton onPress={() => setShowSettings(false)} />
          </View>
          <View style={styles.settingsCard}>
            <Pressable style={styles.settingsRow} onPress={() => { setShowSettings(false); setTimeout(() => setShowChangePassword(true), 300); }}>
              <Text style={styles.settingsRowLabel}>Change password</Text>
              <Text style={styles.settingsRowArrow}>›</Text>
            </Pressable>
            <View style={[styles.settingsRow, styles.settingsRowBorder]}>
              <Text style={styles.settingsRowLabel}>Dark mode</Text>
              <Switch value={isDark} onValueChange={toggle} trackColor={{ false: "#e0e0e0", true: "#4caf50" }} thumbColor="#fff" />
            </View>
            <Pressable style={[styles.settingsRow, styles.settingsRowBorder]} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsRowLabel}>Location permission</Text>
              <Text style={styles.settingsRowArrow}>›</Text>
            </Pressable>
            <Pressable style={[styles.settingsRow, styles.settingsRowBorder]} onPress={confirmDeleteAccount}>
              <Text style={styles.deleteAccountLabel}>Delete account</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showChangePassword} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <CloseButton onPress={() => { setShowChangePassword(false); setNewPassword(""); setConfirmPassword(""); }} />
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
            <CloseButton onPress={() => setActiveModal(null)} />
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
                  {(() => {
                    const border = AVATAR_BORDERS.find((b) => b.id === f.equipped_border_id);
                    return (
                      <View style={[styles.friendAvatarRing, border ? { borderColor: border.color, borderWidth: 3 } : {}]}>
                        {f.avatar_url ? (
                          <Image source={{ uri: f.avatar_url }} style={styles.friendAvatar} />
                        ) : (
                          <View style={styles.friendAvatarPlaceholder}>
                            <Text style={styles.friendAvatarText}>{f.username[0].toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
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
            <CloseButton onPress={() => { setSelectedFriend(null); setActiveModal(null); setFriendReviews([]); setFriendRatings([]); setFriendUpcomingGames([]); setFriendReviewText(""); setShowFriendReviews(false); setRatingStars(0); setRatingComment(""); }} />
          </View>

          {loadingFriend ? (
            <ActivityIndicator style={{ flex: 1 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.modalList}>
              <View style={styles.friendProfileHeader}>
                {(() => {
                  const border = AVATAR_BORDERS.find((b) => b.id === selectedFriend?.equipped_border_id);
                  return (
                    <View style={[styles.friendProfileAvatarRing, border ? { borderColor: border.color, borderWidth: 4 } : {}]}>
                      {selectedFriend?.avatar_url ? (
                        <Image source={{ uri: selectedFriend.avatar_url }} style={styles.friendProfileAvatar} />
                      ) : (
                        <View style={styles.friendProfileAvatarPlaceholder}>
                          <Text style={styles.friendProfileAvatarText}>{(selectedFriend?.username ?? "?")[0].toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
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
                <View style={styles.friendStreakRow}>
                  <Text style={styles.friendStreakText}>🔥 {friendCurrentStreak}-week streak</Text>
                  <Text style={styles.friendStreakSep}>·</Text>
                  <Text style={styles.friendStreakText}>🏆 Best: {friendLongestStreak}</Text>
                </View>
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

function makeStyles(c: Colors) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { padding: 20, paddingBottom: 48 },
  header: { alignItems: "center", marginBottom: 24, paddingTop: 8 },
  avatarWrapper: { marginBottom: 12, position: "relative" },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#212121", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  avatarOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  avatarOverlayText: { fontSize: 24 },
  usernameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  username: { fontSize: 20, fontWeight: "700", color: c.text },
  usernameRating: { fontSize: 13, fontWeight: "600", color: "#f59e0b" },
  usernameInput: { fontSize: 20, fontWeight: "700", color: c.text, borderBottomWidth: 2, borderBottomColor: c.text, marginBottom: 12, minWidth: 150, textAlign: "center" },
  editBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  editBtnText: { fontSize: 13, fontWeight: "500", color: c.text },
  streakCard: { flexDirection: "row", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 12, paddingVertical: 16 },
  streakItem: { flex: 1, alignItems: "center" },
  streakIcon: { fontSize: 20, marginBottom: 4 },
  streakNum: { fontSize: 22, fontWeight: "700", color: c.text },
  streakLabel: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  streakDivider: { width: 1, backgroundColor: c.border },
  friendStreakRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, marginBottom: 4 },
  friendStreakText: { fontSize: 13, color: c.textMuted },
  friendStreakSep: { fontSize: 13, color: c.textFaint },
  statsRow: { flexDirection: "row", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 24, paddingVertical: 16 },
  statBox: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "700", color: c.text },
  statNumAbandoned: { color: "#e65100" },
  statLabel: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: c.border },
  collapsibleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 12 },
  chevron: { fontSize: 11, color: c.placeholder },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: c.placeholder, marginBottom: 10, marginTop: 24 },
  sportsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  sportChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  sportChipActive: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#212121", borderWidth: 1, borderColor: "#212121" },
  sportChipText: { fontSize: 13, color: c.textMuted },
  sportChipTextActive: { color: "#fff", fontWeight: "600", fontSize: 13 },
  editHint: { fontSize: 12, color: c.textFaint, marginBottom: 8 },
  noSportsText: { fontSize: 13, color: c.textFaint, fontStyle: "italic" },
  reviewInputRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  reviewInput: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: c.surface, minHeight: 44, color: c.text },
  reviewSubmitBtn: { paddingHorizontal: 16, borderRadius: 10, backgroundColor: c.primary, justifyContent: "center" },
  reviewSubmitBtnDisabled: { backgroundColor: "#bdbdbd" },
  reviewSubmitText: { color: c.primaryText, fontWeight: "600", fontSize: 13 },
  reviewCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  reviewerName: { fontSize: 13, fontWeight: "600", color: c.text },
  reviewDate: { fontSize: 11, color: c.textFaint },
  reviewComment: { fontSize: 13, color: c.textSub, lineHeight: 20 },
  emptyText: { fontSize: 13, color: c.placeholder, textAlign: "center", marginTop: 16 },
  friendCard: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, marginBottom: 10 },
  friendAvatarRing: { borderRadius: 25, padding: 2, marginRight: 12 },
  friendAvatar: { width: 44, height: 44, borderRadius: 22 },
  friendAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#212121", alignItems: "center", justifyContent: "center" },
  friendAvatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  friendInfo: { flex: 1 },
  friendUsername: { fontSize: 15, fontWeight: "600", color: c.text, marginBottom: 2 },
  friendSports: { fontSize: 12, color: c.textFaint },
  friendArrow: { fontSize: 20, color: c.placeholder },
  friendProfileHeader: { alignItems: "center", marginBottom: 24, paddingTop: 8 },
  friendProfileAvatarRing: { borderRadius: 44, padding: 2, marginBottom: 12 },
  friendProfileAvatar: { width: 80, height: 80, borderRadius: 40 },
  friendProfileAvatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#212121", alignItems: "center", justifyContent: "center" },
  friendProfileAvatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  friendProfileUsername: { fontSize: 20, fontWeight: "700", color: c.text, marginBottom: 10 },
  removeFriendBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  removeFriendBtnText: { fontSize: 13, fontWeight: "600", color: "#e53935" },
  ratingHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  avgStarsText: { fontSize: 13, fontWeight: "600", color: "#f59e0b" },
  ratingCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, marginBottom: 10 },
  ratingCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  ratingDate: { fontSize: 11, color: c.textFaint },
  ratingComment: { fontSize: 13, color: c.textSub, lineHeight: 20 },
  starSelector: { flexDirection: "row", gap: 8, marginBottom: 12 },
  starBtn: { fontSize: 32 },
  backBtnText: { fontSize: 16, color: c.text, fontWeight: "500" },
  signOutBtn: { marginTop: 32, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: "center", backgroundColor: c.surface },
  signOutText: { fontSize: 14, fontWeight: "600", color: "#e53935" },
  settingsChangePasswordText: { fontSize: 14, fontWeight: "600", color: c.text },
  abandonedBadge: { backgroundColor: "#fff3e0", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: "#ff9800" },
  abandonedBadgeText: { fontSize: 11, color: "#e65100", fontWeight: "700" },
  settingsCard: { margin: 20, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  settingsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  settingsRowBorder: { borderTopWidth: 1, borderTopColor: c.borderLight },
  settingsRowLabel: { flex: 1, fontSize: 15, color: c.text },
  deleteAccountLabel: { flex: 1, fontSize: 15, color: "#e53935", fontWeight: "600" },
  settingsRowArrow: { fontSize: 20, color: c.placeholder },
  pwLabel: { fontSize: 12, fontWeight: "600", color: c.textFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  pwInput: { backgroundColor: c.input, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.text, marginBottom: 20 },
  pwSaveBtn: { marginTop: 8, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  pwSaveBtnDisabled: { backgroundColor: "#bdbdbd" },
  pwSaveBtnText: { color: c.primaryText, fontWeight: "700", fontSize: 15 },
  modalSafe: { flex: 1, backgroundColor: c.bg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  modalTitle: { fontSize: 18, fontWeight: "700", color: c.text },
  modalList: { padding: 20, paddingBottom: 48 },
  gameCard: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 },
  gameCardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  gameCardSport: { fontSize: 14, fontWeight: "600", color: c.text },
  gameCardTime: { fontSize: 12, color: c.textFaint },
  gameCardLocation: { fontSize: 14, color: c.textSub, marginBottom: 2 },
  gameCardDate: { fontSize: 11, color: "#1565c0", marginBottom: 4 },
  gameCardMeta: { fontSize: 12, color: c.textFaint },
  // Avatar border ring
  avatarRing: { borderRadius: 44, overflow: "hidden" },
  // Coin chip
  coinChip: { backgroundColor: "#fff8e1", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#ffe082" },
  coinChipText: { fontSize: 13, fontWeight: "700", color: "#e65100" },
  // Shop button
  shopBtnText: { fontSize: 14, fontWeight: "600", color: "#1976d2" },
  // Shop layout
  shopScrollContent: { padding: 16, paddingBottom: 40 },
  shopSectionLabel: { fontSize: 13, fontWeight: "700", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, marginTop: 4 },
  shopGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  // Earn card
  earnCard: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 20 },
  earnTitle: { fontSize: 13, fontWeight: "700", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  earnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  earnIcon: { fontSize: 18, width: 28, textAlign: "center" },
  earnDesc: { flex: 1, fontSize: 14, color: c.text },
  earnAmount: { fontSize: 15, fontWeight: "700", color: "#e65100" },
  earnDivider: { height: 1, backgroundColor: c.borderLight, marginVertical: 10 },
  borderCard: { width: "47%", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14, alignItems: "center", gap: 8 },
  borderCardEquipped: { borderColor: "#1976d2", borderWidth: 2 },
  borderPreviewOuter: { width: 64, height: 64, borderRadius: 32, borderWidth: 5, justifyContent: "center", alignItems: "center" },
  borderPreviewInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#e0e0e0" },
  borderName: { fontSize: 14, fontWeight: "700", color: c.text },
  borderPrice: { fontSize: 12, color: c.textFaint },
  buyBtn: { backgroundColor: "#1976d2", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7, width: "100%", alignItems: "center" },
  buyBtnDisabled: { backgroundColor: c.borderLight },
  buyBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  buyBtnTextDisabled: { color: c.textFaint },
  equipBtn: { backgroundColor: "#e8f5e9", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7, width: "100%", alignItems: "center", borderWidth: 1, borderColor: "#a5d6a7" },
  equipBtnText: { color: "#2e7d32", fontSize: 13, fontWeight: "600" },
  unequipBtn: { backgroundColor: c.borderLight, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7, width: "100%", alignItems: "center" },
  unequipBtnText: { color: c.textMuted, fontSize: 13, fontWeight: "600" },
}); }