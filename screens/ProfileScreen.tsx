import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator, Image,
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
};

type Review = {
  id: string;
  reviewer_name: string;
  comment: string;
  created_at: string;
};

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

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data);
      setUsername(data.username ?? "");
      setSelectedSports(data.sports_interests ?? []);
      setAvatarUri(data.avatar_url ?? null);
    } else {
      const newProfile = {
        id: user.id,
        username: user.email?.split("@")[0] ?? "Player",
        sports_interests: [],
        avatar_url: null,
      };
      await supabase.from("profiles").insert(newProfile);
      setProfile({ ...newProfile });
      setUsername(newProfile.username);
    }
    setLoading(false);
  }, []);

  const fetchReviews = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setReviews(data);
  }, []);

  const fetchStats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count: joined } = await supabase
      .from("game_participants")
      .select("*", { count: "exact", head: true })
      .eq("user_name", user.email);
    const { count: created } = await supabase
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("created_by", user.id);
    setGamesJoined(joined ?? 0);
    setGamesCreated(created ?? 0);
  }, []);

  const fetchFriends = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rows } = await supabase
      .from("friends")
      .select("requester_id, receiver_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (!rows || rows.length === 0) { setFriends([]); return; }
    const ids = rows.map((r) => r.requester_id === user.id ? r.receiver_id : r.requester_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, sports_interests")
      .in("id", ids);
    if (profiles) setFriends(profiles);
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchReviews();
    fetchStats();
    fetchFriends();
  }, [fetchProfile, fetchReviews, fetchStats, fetchFriends]);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAvatarUri(asset.uri);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !asset.base64) return;

    const filePath = `avatars/${user.id}.jpg`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, decode(asset.base64), {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) { Alert.alert("Upload failed", error.message); return; }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    setAvatarUri(publicUrl);
  }

  function decode(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function saveProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ username, sports_interests: selectedSports })
      .eq("id", user.id);
    if (error) { Alert.alert("Error", error.message); return; }
    setProfile((prev) => prev ? { ...prev, username, sports_interests: selectedSports } : prev);
    setEditing(false);
  }

  async function submitReview() {
    if (!reviewText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profile) return;
    if (user.id === profile.id) {
      Alert.alert("Not allowed", "You cannot review yourself.");
      return;
    }
    setSubmittingReview(true);
    const { error } = await supabase.from("reviews").insert({
      profile_id: profile.id,
      reviewer_name: user.email?.split("@")[0] ?? "Anonymous",
      comment: reviewText.trim(),
    });
    setSubmittingReview(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setReviewText("");
    fetchReviews();
  }

  function toggleSport(sport: string) {
    setSelectedSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const isOwnProfile = currentUserId === profile?.id;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={editing ? pickImage : undefined} style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile?.username ?? "?")[0].toUpperCase()}
                </Text>
              </View>
            )}
            {editing && (
              <View style={styles.avatarOverlay}>
                <Text style={styles.avatarOverlayText}>📷</Text>
              </View>
            )}
          </Pressable>

          {editing ? (
            <TextInput
              style={styles.usernameInput}
              value={username}
              onChangeText={setUsername}
              autoFocus
            />
          ) : (
            <Text style={styles.username}>{profile?.username}</Text>
          )}

          {isOwnProfile && (
            <Pressable
              style={styles.editBtn}
              onPress={editing ? saveProfile : () => setEditing(true)}
            >
              <Text style={styles.editBtnText}>{editing ? "Save" : "Edit profile"}</Text>
            </Pressable>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{gamesJoined}</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{gamesCreated}</Text>
            <Text style={styles.statLabel}>Created</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{reviews.length}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{friends.length}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>

        {/* Sports Interests */}
        <Text style={styles.sectionLabel}>Sports Interests</Text>
        {editing ? (
          <>
            <Text style={styles.editHint}>Tap to select your interests</Text>
            <View style={styles.sportsRow}>
              {SPORT_OPTIONS.map((sport) => {
                const active = selectedSports.includes(sport);
                return (
                  <Pressable
                    key={sport}
                    style={[styles.sportChip, active && styles.sportChipActive]}
                    onPress={() => toggleSport(sport)}
                  >
                    <Text style={[styles.sportChipText, active && styles.sportChipTextActive]}>
                      {sport}
                    </Text>
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

        {/* Friends */}
        <Text style={styles.sectionLabel}>Friends ({friends.length})</Text>
        {friends.length === 0 ? (
          <Text style={styles.emptyText}>No friends yet. Find players in the Search tab!</Text>
        ) : (
          friends.map((f) => (
            <View key={f.id} style={styles.friendCard}>
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
                  <Text style={styles.friendSports} numberOfLines={1}>
                    {f.sports_interests.join(" · ")}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}

        {/* Reviews - only others can leave reviews */}
        {!isOwnProfile && (
          <>
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
          </>
        )}

        {/* Reviews List */}
        <Text style={styles.sectionLabel}>Reviews ({reviews.length})</Text>
        {reviews.length === 0 ? (
          <Text style={styles.emptyText}>No reviews yet.</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{r.reviewer_name}</Text>
                <Text style={styles.reviewDate}>
                  {new Date(r.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.reviewComment}>{r.comment}</Text>
            </View>
          ))
        )}

        {/* Sign Out */}
        <Pressable
          style={styles.signOutBtn}
          onPress={() =>
            Alert.alert("For real?", "", [
              { text: "No", style: "cancel" },
              { text: "Yes", style: "destructive", onPress: () => supabase.auth.signOut() },
            ])
          }
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fafafa" },
  container: { padding: 20, paddingBottom: 48 },
  header: { alignItems: "center", marginBottom: 24, paddingTop: 8 },
  avatarWrapper: { marginBottom: 12, position: "relative" },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#212121", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  avatarOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 40, backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  avatarOverlayText: { fontSize: 24 },
  username: { fontSize: 20, fontWeight: "700", color: "#212121", marginBottom: 12 },
  usernameInput: {
    fontSize: 20, fontWeight: "700", color: "#212121",
    borderBottomWidth: 2, borderBottomColor: "#212121",
    marginBottom: 12, minWidth: 150, textAlign: "center",
  },
  editBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: "#212121",
  },
  editBtnText: { fontSize: 13, fontWeight: "500", color: "#212121" },
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
    borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#fff",
  },
  sportChipActive: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#212121", borderWidth: 1, borderColor: "#212121",
  },
  sportChipText: { fontSize: 13, color: "#757575" },
  sportChipTextActive: { color: "#fff", fontWeight: "600", fontSize: 13 },
  editHint: { fontSize: 12, color: "#9e9e9e", marginBottom: 8 },
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
  emptyText: { fontSize: 13, color: "#bdbdbd", textAlign: "center", marginTop: 8 },
  friendCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1,
    borderColor: "#e0e0e0", padding: 12, marginBottom: 10,
  },
  friendAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  friendAvatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#212121",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  friendAvatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  friendInfo: { flex: 1 },
  friendUsername: { fontSize: 15, fontWeight: "600", color: "#212121", marginBottom: 2 },
  friendSports: { fontSize: 12, color: "#9e9e9e" },
  signOutBtn: {
    marginTop: 32, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "#e0e0e0", alignItems: "center",
    backgroundColor: "#fff",
  },
  signOutText: { fontSize: 14, fontWeight: "600", color: "#e53935" },
});