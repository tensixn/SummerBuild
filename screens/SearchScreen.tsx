import { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, FlatList,
  StyleSheet, SafeAreaView, ActivityIndicator, Image, Alert,
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

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

    const results: SearchResult[] = profiles.map((p) => {
      const rel = friends?.find(
        (f) => (f.requester_id === p.id || f.receiver_id === p.id)
      );
      let friendStatus: FriendStatus = "none";
      if (rel) {
        if (rel.status === "accepted") friendStatus = "accepted";
        else if (rel.status === "pending" && rel.requester_id === user.id) friendStatus = "pending_sent";
        else if (rel.status === "pending" && rel.receiver_id === user.id) friendStatus = "pending_received";
      }
      return { ...p, friendStatus };
    });

    setResults(results);
    setLoading(false);
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
    setResults((prev) =>
      prev.map((r) => r.id === receiverId ? { ...r, friendStatus: "pending_sent" } : r)
    );
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
    setResults((prev) =>
      prev.map((r) => r.id === requesterId ? { ...r, friendStatus: "accepted" } : r)
    );
  }

  function renderActionBtn(item: SearchResult) {
    switch (item.friendStatus) {
      case "accepted":
        return (
          <View style={styles.friendBadge}>
            <Text style={styles.friendBadgeText}>Friends</Text>
          </View>
        );
      case "pending_sent":
        return (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Requested</Text>
          </View>
        );
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

        {!loading && query.length < 2 && query.length > 0 && (
          <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {item.username[0].toUpperCase()}
                    </Text>
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
            </View>
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
  addBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: "#212121",
  },
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
  friendBadge: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: "#e8f5e9",
  },
  friendBadgeText: { color: "#2e7d32", fontSize: 12, fontWeight: "600" },
});