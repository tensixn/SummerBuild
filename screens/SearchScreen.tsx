import { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, FlatList,
  StyleSheet, SafeAreaView, ActivityIndicator, Image, Alert, ScrollView,
} from "react-native";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  sports_interests: string[];
};

type FriendStatus = "none" | "pending_sent" | "pending_received" | "accepted";
type SearchResult = Profile & { friendStatus: FriendStatus };

type Review = {
  id: string;
  reviewer_name: string;
  comment: string;
  created_at: string;
};

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<SearchResult | null>(null);
  const [profileReviews, setProfileReviews] = useState<Review[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [profileGamesJoined, setProfileGamesJoined] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  async function search(text: string) {
    setQuery(text);
    if (text.trim().length < 2) { setResults([]); return; }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${text}%`)
      .neq("id", user.id)
      .limit(20);

    if (!profiles) { setLoading(false); return; }

    const { data: friends } = await supabase
      .from("friends")
      .select("*")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

    const mapped: SearchResult[] = profiles.map((p) => {
      const rel = friends?.find(
        (f) => f.requester_id === p.id || f.receiver_id === p.id
      );
      let friendStatus: FriendStatus = "none";
      if (rel) {
        if (rel.status === "accepted") friendStatus = "accepted";
        else if (rel.status === "pending" && rel.requester_id === user.id) friendStatus = "pending_sent";
        else if (rel.status === "pending" && rel.receiver_id === user.id) friendStatus = "pending_received";
      }
      return { ...p, friendStatus };
    });

    setResults(mapped);
    setLoading(false);
  }

  async function openProfile(item: SearchResult) {
    setSelectedProfile(item);

    const { data: reviews } = await supabase
      .from("reviews")
      .select("*")
      .eq("profile_id", item.id)
      .order("created_at", { ascending: false });
    if (reviews) setProfileReviews(reviews);

    const { count } = await supabase
      .from("game_participants")
      .select("*", { count: "exact", head: true })
      .eq("user_name", item.username);
    setProfileGamesJoined(count ?? 0);
  }

  async function sendRequest(receiverId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("friends").insert({
      requester_id: user.id,
      receiver_id: receiverId,
      status: "pending",
    });
    if (error) { Alert.alert("Error", error.message); return; }
    const updated: FriendStatus = "pending_sent";
    setResults((prev) => prev.map((r) => r.id === receiverId ? { ...r, friendStatus: updated } : r));
    if (selectedProfile?.id === receiverId) setSelectedProfile((p) => p ? { ...p, friendStatus: updated } : p);
  }

  async function acceptRequest(requesterId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("requester_id", requesterId)
      .eq("receiver_id", user.id);
    if (error) { Alert.alert("Error", error.message); return; }
    const updated: FriendStatus = "accepted";
    setResults((prev) => prev.map((r) => r.id === requesterId ? { ...r, friendStatus: updated } : r));
    if (selectedProfile?.id === requesterId) setSelectedProfile((p) => p ? { ...p, friendStatus: updated } : p);
  }

  async function submitReview() {
    if (!reviewText.trim() || !selectedProfile) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubmittingReview(true);
    const { error } = await supabase.from("reviews").insert({
      profile_id: selectedProfile.id,
      reviewer_name: user.email?.split("@")[0] ?? "Anonymous",
      comment: reviewText.trim(),
    });
    setSubmittingReview(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setReviewText("");
    const { data: reviews } = await supabase
      .from("reviews")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("created_at", { ascending: false });
    if (reviews) setProfileReviews(reviews);
  }

  function renderActionBtn(item: SearchResult) {
    switch (item.friendStatus) {
      case "accepted":
        return <View style={styles.friendBadge}><Text style={styles.friendBadgeText}>Friends ✓</Text></View>;
      case "pending_sent":
        return <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Requested</Text></View>;
      case "pending_received":
        return (
          <Pressable style={styles.acceptBtn} onPress={() => acceptRequest(item.id)}>
            <Text style={styles.acceptBtnText}>Accept</Text>
          </Pressable>
        );
      default:
        return (
          <Pressable style={styles.addBtn} onPress={() => sendRequest(item.id)}>
            <Text style={styles.addBtnText}>Add friend</Text>
          </Pressable>
        );
    }
  }

  // Profile view
  if (selectedProfile) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backBtn} onPress={() => setSelectedProfile(null)}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {selectedProfile.avatar_url ? (
              <Image source={{ uri: selectedProfile.avatar_url }} style={styles.profileAvatar} />
            ) : (
              <View style={styles.profileAvatarPlaceholder}>
                <Text style={styles.profileAvatarText}>
                  {selectedProfile.username[0].toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.profileUsername}>{selectedProfile.username}</Text>
            <View style={styles.profileActionRow}>
              {renderActionBtn(selectedProfile)}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{profileGamesJoined}</Text>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{profileReviews.length}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
          </View>

          {/* Sports Interests */}
          <Text style={styles.sectionLabel}>Sports Interests</Text>
          <View style={styles.sportsRow}>
            {selectedProfile.sports_interests.length > 0 ? (
              selectedProfile.sports_interests.map((sport) => (
                <View key={sport} style={styles.sportChip}>
                  <Text style={styles.sportChipText}>{sport}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noSportsText}>No sports interests listed.</Text>
            )}
          </View>

          {/* Leave a Review */}
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

          {/* Reviews */}
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
    );
  }

  // Search view
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Find Players</Text>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            value={query}
            onChangeText={search}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setResults([]); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </Pressable>
          )}
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 24 }} />}

        {!loading && query.length >= 2 && results.length === 0 && (
          <Text style={styles.emptyText}>No players found for "{query}"</Text>
        )}

        {!loading && query.length > 0 && query.length < 2 && (
          <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => openProfile(item)}>
              <View style={styles.cardLeft}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{item.username[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardUsername}>{item.username}</Text>
                  {item.sports_interests.length > 0 ? (
                    <Text style={styles.cardSports} numberOfLines={1}>
                      {item.sports_interests.join(" · ")}
                    </Text>
                  ) : (
                    <Text style={styles.cardSportsEmpty}>No sports listed</Text>
                  )}
                </View>
              </View>
              {renderActionBtn(item)}
            </Pressable>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fafafa" },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#212121", marginBottom: 16 },
  backBtn: { marginBottom: 16 },
  backBtnText: { fontSize: 15, color: "#1565c0", fontWeight: "500" },
  searchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0",
    paddingHorizontal: 12, marginBottom: 16,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12, color: "#212121" },
  clearBtn: { fontSize: 14, color: "#9e9e9e", paddingLeft: 8 },
  emptyText: { fontSize: 13, color: "#9e9e9e", textAlign: "center", marginTop: 32 },
  list: { paddingBottom: 40 },
  card: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1,
    borderColor: "#e0e0e0", padding: 12, marginBottom: 10,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#212121",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  cardInfo: { flex: 1 },
  cardUsername: { fontSize: 15, fontWeight: "600", color: "#212121", marginBottom: 2 },
  cardSports: { fontSize: 12, color: "#9e9e9e" },
  cardSportsEmpty: { fontSize: 12, color: "#bdbdbd", fontStyle: "italic" },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: "#212121" },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  pendingBadge: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e0e0e0",
  },
  pendingBadgeText: { color: "#9e9e9e", fontSize: 12, fontWeight: "500" },
  acceptBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: "#e8f5e9", borderWidth: 1, borderColor: "#a5d6a7",
  },
  acceptBtnText: { color: "#2e7d32", fontSize: 12, fontWeight: "600" },
  friendBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: "#e8f5e9" },
  friendBadgeText: { color: "#2e7d32", fontSize: 12, fontWeight: "600" },
  profileHeader: { alignItems: "center", marginBottom: 24, paddingTop: 8 },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  profileAvatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#212121",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  profileAvatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  profileUsername: { fontSize: 20, fontWeight: "700", color: "#212121", marginBottom: 12 },
  profileActionRow: { flexDirection: "row" },
  statsRow: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: "#e0e0e0", marginBottom: 24, paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "700", color: "#212121" },
  statLabel: { fontSize: 11, color: "#9e9e9e", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#e0e0e0" },
  sectionLabel: {
    fontSize: 11, fontWeight: "600", letterSpacing: 0.6,
    textTransform: "uppercase", color: "#bdbdbd", marginBottom: 12, marginTop: 20,
  },
  sportsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  sportChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#212121", borderWidth: 1, borderColor: "#212121",
  },
  sportChipText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  noSportsText: { fontSize: 13, color: "#9e9e9e", fontStyle: "italic" },
  reviewInputRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  reviewInput: {
    flex: 1, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10,
    padding: 12, fontSize: 14, backgroundColor: "#fff", minHeight: 44,
  },
  reviewSubmitBtn: {
    paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: "#212121", justifyContent: "center",
  },
  reviewSubmitBtnDisabled: { backgroundColor: "#bdbdbd" },
  reviewSubmitText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  reviewCard: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1,
    borderColor: "#e0e0e0", padding: 14, marginBottom: 10,
  },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  reviewerName: { fontSize: 13, fontWeight: "600", color: "#212121" },
  reviewDate: { fontSize: 11, color: "#9e9e9e" },
  reviewComment: { fontSize: 13, color: "#424242", lineHeight: 20 },
});