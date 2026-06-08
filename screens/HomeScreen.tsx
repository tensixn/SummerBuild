import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  Alert, StyleSheet, SafeAreaView, Modal, ScrollView, Image, TextInput, RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Game, Sport, SPORTS } from "../lib/types";
import GameCard from "../components/GameCard";
import CreateGameModal from "../components/CreateGameModal";
import ChatModal from "../components/ChatModal";
import { useTheme, Colors } from "../lib/theme";

type Participant = {
  user_name: string;
  profile_id: string | null;
  username: string | null;
  avatar_url: string | null;
  sports_interests: string[] | null;
  recently_abandoned_at: string | null;
};

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

type Notification = {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: string | null;
  related_user_id: string | null;
};

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [games, setGames] = useState<Game[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  // derived from games + joinedIds — no separate fetch needed
  const upcomingGames = useMemo(() => {
    const now = new Date().toISOString();
    return games
      .filter((g) => joinedIds.has(g.id) && g.status === "open" && g.start_time >= now)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [games, joinedIds]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Sport>("All");
  const [modalVisible, setModalVisible] = useState(false);
  const [chatGame, setChatGame] = useState<Game | null>(null);
  const [unreadGameIds, setUnreadGameIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantRatings, setParticipantRatings] = useState<Record<string, string>>({});
  const [ratableGames, setRatableGames] = useState<Game[]>([]);
  const [showRatableGames, setShowRatableGames] = useState(true);
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateGame, setRateGame] = useState<Game | null>(null);
  const [rateParticipants, setRateParticipants] = useState<Profile[]>([]);
  const [ratingSelections, setRatingSelections] = useState<Record<string, number>>({});
  const [reviewSelections, setReviewSelections] = useState<Record<string, string>>({});
  const [submittingGameRating, setSubmittingGameRating] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profileReviews, setProfileReviews] = useState<Review[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [profileInDetail, setProfileInDetail] = useState<Profile | null>(null);
  const [profileInDetailReviews, setProfileInDetailReviews] = useState<Review[]>([]);
  const [profileInDetailStats, setProfileInDetailStats] = useState<{ joined: number; created: number; abandoned: number } | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [leaveConfirmGame, setLeaveConfirmGame] = useState<Game | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const cleanupExpiredGames = useCallback(async () => {
    const now = new Date().toISOString();
    // Open games that have started but end_time hasn't passed → in_progress
    await supabase.from("games").update({ status: "in_progress" }).eq("status", "open").not("end_time", "is", null).lt("start_time", now).gt("end_time", now);
    // In_progress games whose end_time has passed → closed
    await supabase.from("games").update({ status: "closed" }).eq("status", "in_progress").lt("end_time", now);
    // Open games with no end_time that have started → closed
    await supabase.from("games").update({ status: "closed" }).eq("status", "open").is("end_time", null).lt("start_time", now);
  }, []);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    await cleanupExpiredGames();
    const { data, error } = await supabase
      .from("games_with_counts").select("*").in("status", ["open", "in_progress"]).order("start_time", { ascending: true });
    if (error) Alert.alert("Error", error.message);
    else setGames(data ?? []);
    setLoading(false);
  }, [cleanupExpiredGames]);

  const fetchJoined = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("game_participants").select("game_id").eq("user_name", user.email);
    if (data) setJoinedIds(new Set(data.map((r) => r.game_id)));
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

  const fetchRatableGames = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: myParts } = await supabase.from("game_participants").select("game_id").eq("user_id", user.id);
    if (!myParts || myParts.length === 0) { setRatableGames([]); return; }
    const gameIds = myParts.map((p) => p.game_id);
    const { data: completions } = await supabase.from("rated_game_completions").select("game_id").eq("user_id", user.id).in("game_id", gameIds);
    const completedIds = new Set(completions?.map((c) => c.game_id) ?? []);
    const pendingIds = gameIds.filter((id) => !completedIds.has(id));
    if (pendingIds.length === 0) { setRatableGames([]); return; }
    const { data: games } = await supabase.from("games_with_counts").select("*").in("id", pendingIds).lte("start_time", new Date().toISOString()).eq("status", "closed").order("start_time", { ascending: false });
    setRatableGames(games ?? []);
  }, []);

  const checkAndClearAbandonedFlag = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("recently_abandoned_at").eq("id", user.id).single();
    if (!profile?.recently_abandoned_at) return;
    // Clear if 24 hours have passed
    const hoursElapsed = (Date.now() - new Date(profile.recently_abandoned_at).getTime()) / 3600000;
    if (hoursElapsed >= 24) {
      await supabase.from("profiles").update({ recently_abandoned_at: null }).eq("id", user.id);
      return;
    }
    // Clear if user completed a game after the abandonment
    const { data: parts } = await supabase.from("game_participants").select("game_id").eq("user_id", user.id);
    if (!parts || parts.length === 0) return;
    const gameIds = parts.map((p) => p.game_id);
    const { data: completedAfter } = await supabase.from("games").select("id").in("id", gameIds).eq("status", "closed").gt("start_time", profile.recently_abandoned_at).limit(1);
    if (completedAfter && completedAfter.length > 0) {
      await supabase.from("profiles").update({ recently_abandoned_at: null }).eq("id", user.id);
    }
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

  const checkUnreadMessages = useCallback(async () => {
    if (joinedIds.size === 0) return;
    const ids = Array.from(joinedIds);
    const stored = await AsyncStorage.getItem("@chat_last_read");
    const lastReadMap: Record<string, string> = stored ? JSON.parse(stored) : {};
    const { data } = await supabase
      .from("game_messages")
      .select("game_id, created_at")
      .in("game_id", ids)
      .order("created_at", { ascending: false });
    if (!data) return;
    const latestPerGame: Record<string, string> = {};
    for (const msg of data) {
      if (!latestPerGame[msg.game_id]) latestPerGame[msg.game_id] = msg.created_at;
    }
    const unread = new Set<string>();
    for (const gameId of ids) {
      const latest = latestPerGame[gameId];
      if (!latest) continue;
      const lastRead = lastReadMap[gameId];
      if (!lastRead || latest > lastRead) unread.add(gameId);
    }
    setUnreadGameIds(unread);
  }, [joinedIds]);

  // Initial check when joined games are known
  useEffect(() => { checkUnreadMessages(); }, [checkUnreadMessages]);

  // Poll every 15 s so dots appear without needing a manual refresh
  useEffect(() => {
    const interval = setInterval(checkUnreadMessages, 5000);
    return () => clearInterval(interval);
  }, [checkUnreadMessages]);

  async function markGameRead(gameId: string) {
    setUnreadGameIds((prev) => { const next = new Set(prev); next.delete(gameId); return next; });
    const stored = await AsyncStorage.getItem("@chat_last_read");
    const map: Record<string, string> = stored ? JSON.parse(stored) : {};
    map[gameId] = new Date().toISOString();
    await AsyncStorage.setItem("@chat_last_read", JSON.stringify(map));
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchGames(), fetchJoined(), fetchNotifications(), fetchAllNotifications(), fetchRatableGames(), checkAndClearAbandonedFlag()]);
    setRefreshing(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        currentUserIdRef.current = user.id;
        const { data: p } = await supabase.from("profiles").select("username").eq("id", user.id).single();
        if (p) setCurrentUsername(p.username);
      }
    });
    fetchGames();
    fetchJoined();
    fetchNotifications();
    fetchAllNotifications();
    fetchRatableGames();
    checkAndClearAbandonedFlag();

    const channel = supabase.channel("games-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => { fetchGames(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_participants" }, () => { fetchGames(); fetchJoined(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => { fetchNotifications(); fetchAllNotifications(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_messages" }, (payload) => {
        const { game_id, user_id } = payload.new as { game_id: string; user_id: string };
        if (user_id !== currentUserIdRef.current) {
          setUnreadGameIds((prev) => new Set(prev).add(game_id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGames, fetchJoined, fetchNotifications, fetchAllNotifications, fetchRatableGames, checkAndClearAbandonedFlag]);

  async function openGame(game: Game) {
    setSelectedGame(game);
    setLoadingParticipants(true);
    const { data: rows } = await supabase.from("game_participants").select("user_name, user_id").eq("game_id", game.id);
    if (!rows || rows.length === 0) { setParticipants([]); setParticipantRatings({}); setLoadingParticipants(false); return; }
    const userIds = rows.map((r) => r.user_id).filter(Boolean) as string[];
    let profileMap: Record<string, { username: string; avatar_url: string | null; sports_interests: string[]; recently_abandoned_at: string | null }> = {};
    if (userIds.length > 0) {
      const [profilesRes, ratingsRes] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar_url, sports_interests, recently_abandoned_at").in("id", userIds),
        supabase.from("ratings").select("rated_id, stars").in("rated_id", userIds),
      ]);
      if (profilesRes.data) profilesRes.data.forEach((p) => { profileMap[p.id] = p; });
      const accum: Record<string, { sum: number; count: number }> = {};
      ratingsRes.data?.forEach((r) => {
        if (!accum[r.rated_id]) accum[r.rated_id] = { sum: 0, count: 0 };
        accum[r.rated_id].sum += r.stars;
        accum[r.rated_id].count++;
      });
      const newRatings: Record<string, string> = {};
      userIds.forEach((id) => {
        newRatings[id] = accum[id] ? (accum[id].sum / accum[id].count).toFixed(1) + "/4" : "—/4";
      });
      setParticipantRatings(newRatings);
    }
    setParticipants(rows.map((r) => {
      const profile = r.user_id ? profileMap[r.user_id] : null;
      return { user_name: r.user_name, profile_id: r.user_id ?? null, username: profile?.username ?? null, avatar_url: profile?.avatar_url ?? null, sports_interests: profile?.sports_interests ?? null, recently_abandoned_at: profile?.recently_abandoned_at ?? null };
    }));
    setLoadingParticipants(false);
  }

  async function openParticipantProfile(profile: Profile) {
    setProfileInDetail(profile);
    setProfileInDetailStats(null);
    const [reviewsRes, joinedRes, createdRes, profileRes] = await Promise.all([
      supabase.from("reviews").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("game_participants").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.from("games").select("*", { count: "exact", head: true }).eq("created_by", profile.id),
      supabase.from("profiles").select("abandoned_count").eq("id", profile.id).single(),
    ]);
    setProfileInDetailReviews(reviewsRes.data ?? []);
    setProfileInDetailStats({
      joined: joinedRes.count ?? 0,
      created: createdRes.count ?? 0,
      abandoned: profileRes.data?.abandoned_count ?? 0,
    });
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
    const { error } = await supabase.from("reviews").insert({ profile_id: selectedProfile.id, reviewer_name: currentUsername ?? user.email?.split("@")[0] ?? "Anonymous", comment: reviewText.trim() });
    setSubmittingReview(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setReviewText("");
    const { data } = await supabase.from("reviews").select("*").eq("profile_id", selectedProfile.id).order("created_at", { ascending: false });
    if (data) setProfileReviews(data);
  }

  async function joinGame(game: Game) {
    if (game.status === "in_progress" || new Date(game.start_time) <= new Date()) { Alert.alert("Game in progress", "This game has already started and can no longer be joined."); return; }
    if (game.current_players >= game.max_players) { Alert.alert("Full", "This game is already full."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("game_participants").insert({ game_id: game.id, user_name: user.email, user_id: user.id });
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => new Set(prev).add(game.id));
    fetchGames();
  }

  async function doLeaveGame(game: Game) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("game_participants").delete().eq("game_id", game.id).eq("user_name", user.email);
    if (error) { Alert.alert("Error", error.message); return; }
    setJoinedIds((prev) => { const next = new Set(prev); next.delete(game.id); return next; });
    const minsUntilStart = (new Date(game.start_time).getTime() - Date.now()) / 60000;
    if (minsUntilStart >= 0 && minsUntilStart <= 60) {
      const { data: pd } = await supabase.from("profiles").select("abandoned_count").eq("id", user.id).single();
      const { error: updateErr } = await supabase.from("profiles").update({ recently_abandoned_at: new Date().toISOString(), abandoned_count: (pd?.abandoned_count ?? 0) + 1 }).eq("id", user.id);
      if (updateErr) Alert.alert("Error updating profile", updateErr.message);
    }
    fetchGames();
  }

  function leaveGame(game: Game) {
    if (game.status === "in_progress" || new Date(game.start_time) <= new Date()) {
      Alert.alert("Game in progress", "You cannot leave a game that has already started.");
      return;
    }
    const minsUntilStart = (new Date(game.start_time).getTime() - Date.now()) / 60000;
    if (minsUntilStart >= 0 && minsUntilStart <= 60) {
      setLeaveConfirmGame(game);
    } else {
      doLeaveGame(game);
    }
  }

  function kickPlayer(gameId: string, userId: string, name: string) {
    Alert.alert("Kick player?", `Remove ${name} from this game?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Kick", style: "destructive", onPress: async () => {
        const { error } = await supabase.from("game_participants").delete().eq("game_id", gameId).eq("user_id", userId);
        if (error) { Alert.alert("Error", error.message); return; }
        setParticipants((prev) => prev.filter((p) => p.profile_id !== userId));
        fetchGames();
      }},
    ]);
  }

  async function openRateGame(game: Game) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: parts } = await supabase.from("game_participants").select("user_id").eq("game_id", game.id).neq("user_id", user.id);
    const userIds = (parts ?? []).map((p) => p.user_id).filter(Boolean) as string[];
    if (userIds.length === 0) {
      await supabase.from("rated_game_completions").insert({ user_id: user.id, game_id: game.id });
      fetchRatableGames();
      return;
    }
    const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url, sports_interests").in("id", userIds);
    setRateParticipants(profiles ?? []);
    setRateGame(game);
    setRatingSelections({});
    setReviewSelections({});
    setShowRateModal(true);
  }

  async function submitGameRatings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !rateGame) return;
    setSubmittingGameRating(true);
    const ratingEntries = Object.entries(ratingSelections).filter(([_, s]) => s > 0);
    if (ratingEntries.length > 0) {
      await supabase.from("ratings").upsert(
        ratingEntries.map(([userId, stars]) => ({ rater_id: user.id, rated_id: userId, stars })),
        { onConflict: "rater_id,rated_id" }
      );
    }
    const reviewEntries = Object.entries(reviewSelections).filter(([_, c]) => c.trim().length > 0);
    if (reviewEntries.length > 0) {
      await supabase.from("reviews").insert(
        reviewEntries.map(([userId, comment]) => ({
          profile_id: userId,
          reviewer_name: user.email?.split("@")[0] ?? "Anonymous",
          comment: comment.trim(),
        }))
      );
    }
    await supabase.from("rated_game_completions").insert({ user_id: user.id, game_id: rateGame.id });
    setSubmittingGameRating(false);
    setShowRateModal(false);
    setRateGame(null);
    setRateParticipants([]);
    setRatingSelections({});
    setReviewSelections({});
    fetchRatableGames();
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

  function buildCalendarRows(month: Date): (Date | null)[][] {
    const year = month.getFullYear();
    const m = month.getMonth();
    const firstDay = new Date(year, m, 1);
    const lastDay = new Date(year, m + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday-based (0=Mon)
    const rows: (Date | null)[][] = [];
    let currentRow: (Date | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      currentRow.push(new Date(year, m, d));
      if (currentRow.length === 7) { rows.push(currentRow); currentRow = []; }
    }
    if (currentRow.length > 0) {
      while (currentRow.length < 7) currentRow.push(null);
      rows.push(currentRow);
    }
    return rows;
  }

  const filtered = (() => {
    let result = filter === "All" ? games : games.filter((g) => g.sport === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((g) => g.sport.toLowerCase().includes(q) || g.location.toLowerCase().includes(q));
    }
    if (dateFilter !== null) {
      result = result.filter((g) => {
        const gameDate = new Date(g.start_time);
        if (typeof dateFilter === "number") {
          return gameDate.getDay() === dateFilter;
        }
        return gameDate.toDateString() === new Date(dateFilter).toDateString();
      });
    }
    return result;
  })();

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

              {ratableGames.length > 0 && (
                <View style={styles.upcomingSection}>
                  <Pressable style={styles.upcomingHeader} onPress={() => setShowRatableGames(!showRatableGames)}>
                    <Text style={styles.upcomingTitle}>⭐ To Be Rated ({ratableGames.length})</Text>
                    <Text style={styles.upcomingChevron}>{showRatableGames ? "▲" : "▼"}</Text>
                  </Pressable>
                  {showRatableGames && ratableGames.map((game) => (
                    <Pressable key={game.id} style={styles.upcomingCard} onPress={() => openRateGame(game)}>
                      <View style={styles.upcomingCardLeft}>
                        <Text style={styles.upcomingSport}>{game.sport}</Text>
                        <Text style={styles.upcomingLocation}>{game.location}</Text>
                        <Text style={styles.upcomingTime}>{formatDate(game.start_time)}</Text>
                      </View>
                      <View style={styles.rateNowBtn}>
                        <Text style={styles.rateNowBtnText}>Rate →</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Search + Advanced Filter */}
              <View style={styles.searchRow}>
                <View style={styles.searchBar}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by sport or location..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor="#bdbdbd"
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery("")}>
                      <Text style={styles.searchClear}>✕</Text>
                    </Pressable>
                  )}
                </View>
                <Pressable
                  style={[styles.filterToggleBtn, showAdvancedFilter && styles.filterToggleBtnActive]}
                  onPress={() => setShowAdvancedFilter(!showAdvancedFilter)}
                >
                  <Text style={[styles.filterToggleIcon, showAdvancedFilter && styles.filterToggleIconActive]}>
                    {showAdvancedFilter ? "▲" : "▼"}
                  </Text>
                  <Text style={[styles.filterToggleLabel, showAdvancedFilter && styles.filterToggleLabelActive]}>Filter</Text>
                </Pressable>
              </View>

              {showAdvancedFilter && (
                <View style={styles.advancedFilter}>
                  {/* Filter by day */}
                  <Text style={styles.advancedFilterLabel}>Filter by day</Text>
                  <View style={styles.dayFilterRow}>
                    {([
                      { label: "Mon", value: 1 },
                      { label: "Tue", value: 2 },
                      { label: "Wed", value: 3 },
                      { label: "Thu", value: 4 },
                      { label: "Fri", value: 5 },
                      { label: "Sat", value: 6 },
                      { label: "Sun", value: 0 },
                    ] as { label: string; value: number }[]).map(({ label, value }) => (
                      <Pressable
                        key={label}
                        style={[styles.dayChip, typeof dateFilter === "number" && dateFilter === value && styles.dayChipActive]}
                        onPress={() => setDateFilter(typeof dateFilter === "number" && dateFilter === value ? null : value)}
                      >
                        <Text style={[styles.dayChipText, typeof dateFilter === "number" && dateFilter === value && styles.dayChipTextActive]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Filter by date — inline calendar */}
                  <Text style={[styles.advancedFilterLabel, { marginTop: 14 }]}>Filter by date</Text>
                  <View style={styles.calendarContainer}>
                    {/* Month navigation */}
                    <View style={styles.calendarHeader}>
                      <Pressable onPress={() => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() - 1); setCalendarMonth(d); }} style={styles.calNavBtn}>
                        <Text style={styles.calNavText}>‹</Text>
                      </Pressable>
                      <Text style={styles.calMonthLabel}>
                        {calendarMonth.toLocaleDateString("en-SG", { month: "long", year: "numeric" })}
                      </Text>
                      <Pressable onPress={() => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() + 1); setCalendarMonth(d); }} style={styles.calNavBtn}>
                        <Text style={styles.calNavText}>›</Text>
                      </Pressable>
                    </View>
                    {/* Day-of-week headers */}
                    <View style={styles.calDayNamesRow}>
                      {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((n) => (
                        <Text key={n} style={styles.calDayName}>{n}</Text>
                      ))}
                    </View>
                    {/* Date grid */}
                    {buildCalendarRows(calendarMonth).map((week, wi) => (
                      <View key={wi} style={styles.calWeekRow}>
                        {week.map((day, di) => {
                          if (!day) return <View key={di} style={styles.calDaySlot} />;
                          const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                          const isSelected = typeof dateFilter === "string" && new Date(dateFilter).toDateString() === day.toDateString();
                          const isToday = day.toDateString() === new Date().toDateString();
                          const isPast = day < new Date(new Date().toDateString());
                          return (
                            <Pressable
                              key={di}
                              style={styles.calDaySlot}
                              onPress={() => !isPast && setDateFilter(isSelected ? null : iso)}
                              disabled={isPast}
                            >
                              <View style={[styles.calDayCircle, isSelected && styles.calDayCircleSelected, isToday && !isSelected && styles.calDayCircleToday]}>
                                <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected, isPast && styles.calDayTextPast, isToday && !isSelected && styles.calDayTextToday]}>
                                  {day.getDate()}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>

                  {dateFilter !== null && (
                    <Pressable onPress={() => setDateFilter(null)} style={styles.clearDateFilter}>
                      <Text style={styles.clearDateFilterText}>
                        {typeof dateFilter === "string"
                          ? `Clear ${new Date(dateFilter).toLocaleDateString("en-SG", { day: "numeric", month: "short" })} ✕`
                          : "Clear day filter ✕"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              <Text style={styles.sectionLabel}>
                Open games{(searchQuery.trim() || dateFilter !== null) ? " · filtered" : ""}
              </Text>
              {loading && <ActivityIndicator style={{ marginTop: 32 }} />}
            </>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  No {filter === "All" ? "" : filter.toLowerCase() + " "}games
                  {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ""}
                  {dateFilter !== null ? " on the selected day" : ""}.
                  {"\n"}
                  {!searchQuery.trim() && dateFilter === null ? "Create one!" : "Try different filters."}
                </Text>
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
                onChat={(g) => { markGameRead(g.id); setChatGame(g); }}
                hasUnread={joinedIds.has(item.id) && unreadGameIds.has(item.id)}
              />
            </Pressable>
          )}
          contentContainerStyle={styles.list}
        />
      </View>

      <CreateGameModal visible={modalVisible} onClose={() => setModalVisible(false)} onCreated={() => { fetchGames(); }} />

      <ChatModal
        visible={!!chatGame}
        gameId={chatGame?.id ?? ""}
        gameTitle={chatGame ? `${chatGame.sport} · ${chatGame.location}` : ""}
        onClose={() => { if (chatGame) markGameRead(chatGame.id); setChatGame(null); }}
      />

      {/* Popup for new notifications */}
      <Modal visible={showNotifModal} animationType="fade" transparent>
        <View style={styles.notifOverlay}>
          <View style={styles.notifModal}>
            <Text style={styles.notifModalTitle}>🔔 New Notifications</Text>
            {notifications.map((n) => (
              <View key={n.id} style={[styles.notifItem, n.type === "game_ended" && styles.notifItemRating]}>
                {n.type === "game_ended" && <Text style={styles.notifTypeIcon}>⭐ Time to Rate</Text>}
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
              <View style={[styles.mailboxItem, n.is_read && styles.mailboxItemRead, n.type === "game_ended" && !n.is_read && styles.mailboxItemRating]}>
                <View style={styles.mailboxItemRow}>
                  <Text style={styles.mailboxDot}>
                    {n.type === "game_ended" ? "⭐" : n.is_read ? "○" : "●"}
                  </Text>
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
                <Text style={styles.profileRatingDisplay}>
                  ★ {participantRatings[profileInDetail.id] ?? "—/4"}
                </Text>
                {profileInDetail.recently_abandoned_at && (
                  <View style={styles.abandonedBadge}>
                    <Text style={styles.abandonedBadgeText}>Recently Abandoned</Text>
                  </View>
                )}
              </View>
              <View style={styles.profileStatsRow}>
                <View style={styles.profileStatItem}>
                  <Text style={styles.profileStatNum}>{profileInDetailStats?.joined ?? "—"}</Text>
                  <Text style={styles.profileStatLabel}>Joined</Text>
                </View>
                <View style={styles.profileStatDivider} />
                <View style={styles.profileStatItem}>
                  <Text style={styles.profileStatNum}>{profileInDetailStats?.created ?? "—"}</Text>
                  <Text style={styles.profileStatLabel}>Created</Text>
                </View>
                <View style={styles.profileStatDivider} />
                <View style={styles.profileStatItem}>
                  <Text style={[styles.profileStatNum, (profileInDetailStats?.abandoned ?? 0) > 0 && styles.profileStatNumAbandoned]}>{profileInDetailStats?.abandoned ?? "—"}</Text>
                  <Text style={styles.profileStatLabel}>Abandoned</Text>
                </View>
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
              <Pressable
                style={styles.chatRowBtn}
                onPress={() => {
                  if (!selectedGame) return;
                  const game = selectedGame;
                  setSelectedGame(null);
                  setParticipants([]);
                  setProfileInDetail(null);
                  setProfileInDetailReviews([]);
                  markGameRead(game.id);
                  setChatGame(game);
                }}
              >
                <Text style={styles.chatRowIcon}>💬</Text>
                <Text style={styles.chatRowText}>Game Chat</Text>
                <Text style={styles.chatRowArrow}>›</Text>
              </Pressable>
              <Text style={styles.sectionLabel}>Players Joined</Text>
              {loadingParticipants ? (
                <ActivityIndicator style={{ marginTop: 16 }} />
              ) : participants.length === 0 ? (
                <Text style={styles.emptyText}>No one has joined yet.</Text>
              ) : (
                [...participants]
                  .sort((a, b) => {
                    const aIsHost = a.profile_id === selectedGame?.created_by ? -1 : 1;
                    const bIsHost = b.profile_id === selectedGame?.created_by ? -1 : 1;
                    return aIsHost - bIsHost;
                  })
                  .map((p) => (
                  <Pressable
                    key={p.user_name}
                    style={styles.participantCard}
                    onPress={() => {
                      if (!p.profile_id) return;
                      openParticipantProfile({ id: p.profile_id, username: p.username ?? p.user_name, avatar_url: p.avatar_url ?? null, sports_interests: p.sports_interests ?? [], recently_abandoned_at: p.recently_abandoned_at ?? null });
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
                      <View style={styles.participantRatingRow}>
                        {p.sports_interests && p.sports_interests.length > 0 && (
                          <Text style={styles.participantSports} numberOfLines={1}>{p.sports_interests.join(" · ")}</Text>
                        )}
                        {p.profile_id && (
                          <Text style={styles.participantRating}>★ {participantRatings[p.profile_id] ?? "—/4"}</Text>
                        )}
                        {p.recently_abandoned_at && (
                          <View style={styles.abandonedBadge}>
                            <Text style={styles.abandonedBadgeText}>Recently Abandoned</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {currentUserId === selectedGame?.created_by && p.profile_id !== currentUserId ? (
                      <Pressable style={styles.kickBtn} onPress={(e) => { e.stopPropagation(); kickPlayer(selectedGame!.id, p.profile_id!, p.username ?? p.user_name); }}>
                        <Text style={styles.kickBtnText}>Kick</Text>
                      </Pressable>
                    ) : (
                      p.profile_id && <Text style={styles.participantArrow}>›</Text>
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Leave Confirmation Modal */}
      <Modal visible={leaveConfirmGame !== null} animationType="fade" transparent>
        <View style={styles.leaveOverlay}>
          <View style={styles.leaveModal}>
            <Text style={styles.leaveModalTitle}>Leave game?</Text>
            <Text style={styles.leaveModalSport}>
              {leaveConfirmGame?.sport} · {leaveConfirmGame?.location}
            </Text>

            <View style={styles.leaveWarningBox}>
              <Text style={styles.leaveWarningIcon}>⚠️</Text>
              <Text style={styles.leaveWarningText}>
                This game starts in less than 1 hour. Leaving now will give you a{" "}
                <Text style={styles.leaveWarningBold}>Recently Abandoned</Text> badge visible to all players.
              </Text>
            </View>

            <View style={styles.leaveHowToBox}>
              <Text style={styles.leaveHowToTitle}>How to remove the badge</Text>
              <Text style={styles.leaveHowToText}>
                <Text style={styles.leaveHowToBullet}>• </Text>Join another game and complete it.{"\n"}
                <Text style={styles.leaveHowToBullet}>• </Text>Wait 24 hours — the badge clears automatically.
              </Text>
            </View>

            <View style={styles.leaveModalBtns}>
              <Pressable style={styles.leaveStayBtn} onPress={() => setLeaveConfirmGame(null)}>
                <Text style={styles.leaveStayBtnText}>Stay in game</Text>
              </Pressable>
              <Pressable
                style={styles.leaveConfirmBtn}
                onPress={() => { const g = leaveConfirmGame; setLeaveConfirmGame(null); if (g) doLeaveGame(g); }}
              >
                <Text style={styles.leaveConfirmBtnText}>Leave anyway</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rate Game Modal */}
      <Modal visible={showRateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>⭐ Rate Players</Text>
              {rateGame && <Text style={styles.rateGameSubtitle}>{rateGame.sport} · {rateGame.location}</Text>}
            </View>
            <Pressable onPress={() => { setShowRateModal(false); setRateGame(null); setRateParticipants([]); setRatingSelections({}); setReviewSelections({}); }}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {rateParticipants.map((p) => (
              <View key={p.id} style={styles.ratePlayerCard}>
                <View style={styles.ratePlayerLeft}>
                  {p.avatar_url ? (
                    <Image source={{ uri: p.avatar_url }} style={styles.participantAvatar} />
                  ) : (
                    <View style={styles.participantAvatarPlaceholder}>
                      <Text style={styles.participantAvatarText}>{p.username[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.ratePlayerName}>{p.username}</Text>
                </View>
                <View style={styles.rateStarsRow}>
                  {[1, 2, 3, 4].map((s) => (
                    <Pressable key={s} onPress={() => setRatingSelections((prev) => ({ ...prev, [p.id]: prev[p.id] === s ? 0 : s }))}>
                      <Text style={{ fontSize: 28, color: s <= (ratingSelections[p.id] ?? 0) ? "#f59e0b" : "#e0e0e0" }}>★</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.rateReviewInput}
                  placeholder="Leave a review (optional)"
                  value={reviewSelections[p.id] ?? ""}
                  onChangeText={(t) => setReviewSelections((prev) => ({ ...prev, [p.id]: t }))}
                  multiline
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.rateFooter}>
            <Pressable style={styles.rateDoneBtn} onPress={submitGameRatings} disabled={submittingGameRating}>
              <Text style={styles.rateDoneBtnText}>{submittingGameRating ? "Submitting..." : "Done Rating"}</Text>
            </Pressable>
          </View>
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

function makeStyles(c: Colors) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, marginBottom: 2 },
  appName: { fontSize: 22, fontWeight: "700", color: c.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  notifBtn: { position: "relative" },
  notifIcon: { fontSize: 22 },
  notifBadge: { position: "absolute", top: -4, right: -4, backgroundColor: "#e53935", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" },
  notifBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4caf50" },
  liveText: { fontSize: 12, color: c.textFaint },
  sub: { fontSize: 13, color: c.textFaint, marginBottom: 16 },
  filterRow: { gap: 8, paddingBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: 13, color: c.textMuted },
  chipTextActive: { color: c.primaryText, fontWeight: "600" },
  createBtn: { borderWidth: 1, borderStyle: "dashed", borderColor: c.placeholder, borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 20, backgroundColor: c.surface },
  createBtnText: { fontSize: 14, color: c.textMuted },
  upcomingSection: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 20, overflow: "hidden" },
  upcomingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  upcomingTitle: { fontSize: 14, fontWeight: "600", color: c.text },
  upcomingChevron: { fontSize: 12, color: c.textFaint },
  upcomingCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.borderLight },
  upcomingCardLeft: { flex: 1 },
  upcomingSport: { fontSize: 14, fontWeight: "600", color: c.text, marginBottom: 2 },
  upcomingLocation: { fontSize: 12, color: c.textMuted, marginBottom: 2 },
  upcomingTime: { fontSize: 11, color: c.textFaint },
  upcomingSlots: { alignItems: "center" },
  upcomingSlotsText: { fontSize: 16, fontWeight: "700", color: c.text },
  upcomingSlotsLabel: { fontSize: 10, color: c.textFaint },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase", color: c.placeholder, marginBottom: 12, marginTop: 20 },
  list: { paddingBottom: 40 },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyText: { fontSize: 14, color: c.placeholder, textAlign: "center", lineHeight: 22 },
  notifOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  notifModal: { backgroundColor: c.surface, borderRadius: 16, padding: 24, width: "100%" },
  notifModalTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 16 },
  notifItem: { backgroundColor: "#fff3e0", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#ffe0b2" },
  notifMessage: { fontSize: 13, color: c.text, lineHeight: 20, marginBottom: 4 },
  notifMessageRead: { color: c.textFaint },
  notifTime: { fontSize: 11, color: c.textFaint },
  notifItemRating: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  notifTypeIcon: { fontSize: 12, fontWeight: "700", color: "#f59e0b", marginBottom: 4 },
  mailboxItemRating: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  notifDismissBtn: { backgroundColor: c.primary, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  notifDismissText: { color: c.primaryText, fontWeight: "600", fontSize: 14 },
  mailboxItem: { backgroundColor: "#fff3e0", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#ffe0b2" },
  mailboxItemRead: { backgroundColor: c.bg, borderColor: c.border },
  mailboxItemRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  mailboxDot: { fontSize: 12, color: "#e53935", marginTop: 2 },
  friendReqBtns: { flexDirection: "row", gap: 8, marginTop: 10 },
  acceptFriendBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  acceptFriendBtnText: { color: c.primaryText, fontWeight: "600", fontSize: 13 },
  declineFriendBtn: { flex: 1, backgroundColor: c.surface, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: c.border },
  declineFriendBtnText: { color: c.textMuted, fontWeight: "600", fontSize: 13 },
  mailboxFooter: { padding: 20, borderTopWidth: 1, borderTopColor: c.borderLight },
  markAllReadBtn: { backgroundColor: c.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  markAllReadText: { color: c.primaryText, fontWeight: "600", fontSize: 14 },
  modalSafe: { flex: 1, backgroundColor: c.bg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  modalTitle: { fontSize: 17, fontWeight: "700", color: c.text, flex: 1, marginRight: 8 },
  modalClose: { fontSize: 16, color: c.textFaint },
  backBtn: { flex: 1, marginRight: 8 },
  backBtnText: { fontSize: 16, color: c.text, fontWeight: "500" },
  modalContent: { padding: 20, paddingBottom: 48 },
  gameInfoRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 8 },
  gameInfoText: { fontSize: 13, color: c.textMuted },
  chatRowBtn: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4, gap: 10 },
  chatRowIcon: { fontSize: 18 },
  chatRowText: { flex: 1, fontSize: 15, fontWeight: "500", color: c.text },
  chatRowArrow: { fontSize: 18, color: c.placeholder },
  participantCard: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, marginBottom: 10 },
  participantAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  participantAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#212121", alignItems: "center", justifyContent: "center", marginRight: 12 },
  participantAvatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  participantInfo: { flex: 1 },
  participantNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  participantName: { fontSize: 15, fontWeight: "600", color: c.text },
  creatorBadge: { fontSize: 11, fontWeight: "600", color: "#1565c0", backgroundColor: "#e3f2fd", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  participantRatingRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  participantSports: { fontSize: 12, color: c.textFaint, flex: 1 },
  participantRating: { fontSize: 12, color: "#f59e0b", fontWeight: "600" },
  kickBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#fdecea", borderWidth: 1, borderColor: "#f5c6c6", marginLeft: 6 },
  kickBtnText: { fontSize: 12, color: "#e53935", fontWeight: "600" },
  profileRatingDisplay: { fontSize: 14, fontWeight: "600", color: "#f59e0b", marginTop: 4, marginBottom: 8 },
  rateNowBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.primary, borderRadius: 8 },
  rateNowBtnText: { color: c.primaryText, fontSize: 12, fontWeight: "600" },
  rateGameSubtitle: { fontSize: 12, color: c.textFaint, marginTop: 2 },
  ratePlayerCard: { flexDirection: "column", backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, marginBottom: 10 },
  ratePlayerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  ratePlayerName: { fontSize: 15, fontWeight: "600", color: c.text },
  rateStarsRow: { flexDirection: "row", gap: 4 },
  rateReviewInput: { marginTop: 10, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, fontSize: 13, backgroundColor: c.input, minHeight: 40, color: c.text },
  rateFooter: { padding: 20, borderTopWidth: 1, borderTopColor: c.borderLight },
  rateDoneBtn: { backgroundColor: c.primary, borderRadius: 12, padding: 16, alignItems: "center" },
  rateDoneBtnText: { color: c.primaryText, fontWeight: "700", fontSize: 15 },
  participantArrow: { fontSize: 20, color: c.placeholder },
  profileHeader: { alignItems: "center", marginBottom: 24 },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  profileAvatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#212121", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  profileAvatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  profileUsername: { fontSize: 20, fontWeight: "700", color: c.text },
  sportsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  sportChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#212121", borderWidth: 1, borderColor: "#212121" },
  sportChipText: { color: "#fff", fontWeight: "600", fontSize: 13 },
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
  abandonedBadge: { backgroundColor: "#fff3e0", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#ff9800" },
  abandonedBadgeText: { fontSize: 10, color: "#e65100", fontWeight: "700" },
  profileStatsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: c.borderLight, borderRadius: 12, paddingVertical: 14, marginBottom: 20, marginTop: 4 },
  profileStatItem: { flex: 1, alignItems: "center" },
  profileStatNum: { fontSize: 20, fontWeight: "700", color: c.text },
  profileStatNumAbandoned: { color: "#e65100" },
  profileStatLabel: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  profileStatDivider: { width: 1, height: 32, backgroundColor: c.border },
  leaveOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 },
  leaveModal: { backgroundColor: c.surface, borderRadius: 18, padding: 24, width: "100%" },
  leaveModalTitle: { fontSize: 20, fontWeight: "700", color: c.text, marginBottom: 4 },
  leaveModalSport: { fontSize: 13, color: c.textFaint, marginBottom: 20 },
  leaveWarningBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#fff8e1", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#ffe082" },
  leaveWarningIcon: { fontSize: 18, marginTop: 1 },
  leaveWarningText: { flex: 1, fontSize: 14, color: "#5d4037", lineHeight: 20 },
  leaveWarningBold: { fontWeight: "700", color: "#e65100" },
  leaveHowToBox: { backgroundColor: c.borderLight, borderRadius: 12, padding: 14, marginBottom: 24 },
  leaveHowToTitle: { fontSize: 13, fontWeight: "700", color: c.textSub, marginBottom: 4 },
  leaveHowToText: { fontSize: 13, color: c.textMuted, lineHeight: 22 },
  leaveHowToBullet: { fontWeight: "700", color: "#e65100" },
  leaveModalBtns: { flexDirection: "row", gap: 10 },
  leaveStayBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: "center", backgroundColor: c.surface },
  leaveStayBtnText: { fontSize: 14, fontWeight: "600", color: c.text },
  leaveConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#e53935", alignItems: "center" },
  leaveConfirmBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 8 },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  searchIcon: { fontSize: 14, color: c.textFaint, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: c.text },
  searchClear: { fontSize: 14, color: c.placeholder, paddingLeft: 8 },
  filterToggleBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  filterToggleBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  filterToggleIcon: { fontSize: 10, color: c.textMuted },
  filterToggleIconActive: { color: c.primaryText },
  filterToggleLabel: { fontSize: 13, color: c.textMuted, fontWeight: "500" },
  filterToggleLabelActive: { color: c.primaryText, fontWeight: "600" },
  advancedFilter: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 4 },
  advancedFilterLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase", color: c.placeholder, marginBottom: 10 },
  dayFilterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 2 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.input },
  dayChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  dayChipText: { fontSize: 13, color: c.textMuted },
  dayChipTextActive: { color: c.primaryText, fontWeight: "600" },
  clearDateFilter: { marginTop: 12, alignSelf: "center" },
  clearDateFilterText: { fontSize: 12, color: "#e53935", fontWeight: "500" },
  calendarContainer: { backgroundColor: c.input, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: c.borderLight },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  calNavBtn: { padding: 4, paddingHorizontal: 10 },
  calNavText: { fontSize: 20, color: c.text, fontWeight: "400" },
  calMonthLabel: { fontSize: 14, fontWeight: "600", color: c.text },
  calDayNamesRow: { flexDirection: "row", marginBottom: 4 },
  calDayName: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: c.textFaint },
  calWeekRow: { flexDirection: "row" },
  calDaySlot: { flex: 1, alignItems: "center", paddingVertical: 3 },
  calDayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  calDayCircleSelected: { backgroundColor: c.primary },
  calDayCircleToday: { backgroundColor: "#e8f4fd", borderWidth: 1, borderColor: "#1976d2" },
  calDayText: { fontSize: 13, color: c.text },
  calDayTextSelected: { color: c.primaryText, fontWeight: "700" },
  calDayTextPast: { color: c.placeholder },
  calDayTextToday: { color: "#1976d2", fontWeight: "700" },
}); }