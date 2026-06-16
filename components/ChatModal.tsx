import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, Modal, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useTheme, Colors } from "../lib/theme";
import CloseButton from "./CloseButton";

type Message = {
  id: string;
  game_id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  gameTitle: string;
};

export default function ChatModal({ visible, onClose, gameId, gameTitle }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [isParticipant, setIsParticipant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletedUserIds, setDeletedUserIds] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible || !gameId) return;
    let active = true;
    setLoading(true);
    setMessages([]);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      setCurrentUserId(user.id);

      const [{ data: profile }, { data: participation }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", user.id).single(),
        supabase.from("game_participants").select("game_id").eq("game_id", gameId).eq("user_id", user.id).maybeSingle(),
        supabase.from("game_messages").select("*").eq("game_id", gameId).order("created_at", { ascending: true }),
      ]);

      if (!active) return;
      setCurrentUsername(profile?.username ?? user.email?.split("@")[0] ?? "Player");
      setIsParticipant(!!participation);
      setMessages(msgs ?? []);

      if (msgs && msgs.length > 0) {
        const otherIds = [...new Set((msgs as Message[]).map((m) => m.user_id))].filter((id) => id !== user.id);
        if (otherIds.length > 0) {
          const { data: activeProfiles } = await supabase.from("profiles").select("id").in("id", otherIds);
          if (active) {
            const activeSet = new Set((activeProfiles ?? []).map((p: { id: string }) => p.id));
            setDeletedUserIds(new Set(otherIds.filter((id) => !activeSet.has(id))));
          }
        }
      }

      setLoading(false);
    })();

    const channel = supabase
      .channel(`chat-${gameId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_messages", filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (!active) return;
          const incoming = payload.new as Message;
          setMessages((prev) =>
            prev.find((m) => m.id === incoming.id) ? prev : [...prev, incoming]
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [visible, gameId]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !currentUserId || sending) return;
    setSending(true);
    setInput("");
    const { data, error } = await supabase
      .from("game_messages")
      .insert({
        game_id: gameId,
        user_id: currentUserId,
        username: currentUsername,
        message: text,
      })
      .select()
      .single();
    setSending(false);
    if (error) {
      setInput(text);
    } else if (data) {
      // Show immediately without waiting for the real-time event
      setMessages((prev) =>
        prev.find((m) => m.id === (data as Message).id) ? prev : [...prev, data as Message]
      );
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function renderMessage({ item, index }: { item: Message; index: number }) {
    const isOwn = item.user_id === currentUserId;
    const isDeleted = !isOwn && deletedUserIds.has(item.user_id);
    const displayName = isDeleted ? "Deleted User" : item.username;
    const showName = !isOwn && messages[index - 1]?.user_id !== item.user_id;

    return (
      <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
        {!isOwn && (
          <View style={[styles.avatar, !showName && styles.avatarHidden, isDeleted && styles.avatarDeleted]}>
            {!isDeleted && <Text style={styles.avatarText}>{item.username[0]?.toUpperCase()}</Text>}
          </View>
        )}
        <View style={[styles.bubbleWrap, isOwn && styles.bubbleWrapOwn]}>
          {showName && <Text style={[styles.senderName, isDeleted && styles.deletedName]}>{displayName}</Text>}
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
            <Text style={isOwn ? styles.msgTextOwn : styles.msgTextOther}>{item.message}</Text>
          </View>
          <Text style={[styles.timestamp, isOwn && styles.timestampOwn]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{gameTitle}</Text>
            <Text style={styles.headerSub}>Game Chat</Text>
          </View>
          <CloseButton onPress={onClose} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textMuted} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.msgList}
            onContentSizeChange={scrollToEnd}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No messages yet.{"\n"}Be the first to say hi!</Text>
            }
          />
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.bottom + 8}
        >
          <View style={[styles.inputBar, { paddingBottom: insets.bottom || 16 }]}>
            {isParticipant ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Message..."
                  placeholderTextColor={colors.placeholder}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                  maxLength={300}
                  multiline
                />
                <Pressable
                  style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff]}
                  onPress={sendMessage}
                  disabled={!input.trim() || sending}
                >
                  <Ionicons name="send" size={16} color={styles.sendIcon.color} />
                </Pressable>
              </>
            ) : (
              <Text style={styles.lockedText}>Join the game to send messages</Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    headerTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    headerSub: { fontSize: 12, color: c.textFaint, marginTop: 2 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    msgList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
    emptyText: {
      fontSize: 13, color: c.placeholder, textAlign: "center",
      marginTop: 48, lineHeight: 22,
    },
    msgRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-end" },
    msgRowOwn: { justifyContent: "flex-end" },
    msgRowOther: { justifyContent: "flex-start" },
    avatar: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: "#212121",
      alignItems: "center", justifyContent: "center",
      marginRight: 8, flexShrink: 0,
    },
    avatarHidden: { opacity: 0 },
    avatarDeleted: { backgroundColor: "#9e9e9e" },
    avatarText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    deletedName: { fontStyle: "italic" },
    bubbleWrap: { maxWidth: "72%", alignItems: "flex-start" },
    bubbleWrapOwn: { alignItems: "flex-end" },
    senderName: { fontSize: 11, color: c.textFaint, marginBottom: 3, marginLeft: 4 },
    bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, marginBottom: 2 },
    bubbleOwn: {
      backgroundColor: c.primary,
      borderBottomRightRadius: 5,
    },
    bubbleOther: {
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
      borderBottomLeftRadius: 5,
    },
    msgTextOwn: { fontSize: 14, color: c.primaryText, lineHeight: 20 },
    msgTextOther: { fontSize: 14, color: c.text, lineHeight: 20 },
    timestamp: { fontSize: 10, color: c.textFaint, marginLeft: 4 },
    timestampOwn: { textAlign: "right", marginRight: 4, marginLeft: 0 },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 14,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 14,
      color: c.text,
      maxHeight: 100,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.primary,
      alignItems: "center", justifyContent: "center",
    },
    sendBtnOff: { opacity: 0.3 },
    sendIcon: { fontSize: 14, color: c.primaryText, marginLeft: 2 },
    lockedText: {
      flex: 1, textAlign: "center",
      fontSize: 13, color: c.textFaint, paddingVertical: 12,
    },
  });
}
