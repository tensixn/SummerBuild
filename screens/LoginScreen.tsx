import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ onSwitch, onLogin }: {
  onSwitch: () => void;
  onLogin: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert("Error", error.message);
    else onLogin();
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const redirectTo = "exp+ntu-sports-app:///";
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);

      if (result.type === "success") {
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.replace("#", ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) throw sessionError;
          onLogin();
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>NTU Sports</Text>
      <Text style={styles.subtitle}>Sign in to join games</Text>

      <Pressable
        style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
        onPress={handleGoogleLogin}
        disabled={googleLoading}
      >
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleBtnText}>
          {googleLoading ? "Redirecting..." : "Continue with Google"}
        </Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? "Signing in..." : "Sign in"}</Text>
      </Pressable>

      <Pressable onPress={onSwitch}>
        <Text style={styles.switchText}>
          Don't have an account? <Text style={styles.switchLink}>Sign up</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "700", color: "#212121", marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#9e9e9e", marginBottom: 32, textAlign: "center" },
  input: {
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10,
    padding: 14, fontSize: 15, marginBottom: 14, backgroundColor: "#fafafa",
  },
  btn: {
    backgroundColor: "#212121", borderRadius: 10,
    padding: 16, alignItems: "center", marginBottom: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10,
    padding: 14, marginBottom: 16, backgroundColor: "#fff", gap: 10,
  },
  googleIcon: { fontSize: 16, fontWeight: "700", color: "#4285F4" },
  googleBtnText: { fontSize: 15, fontWeight: "600", color: "#212121" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e0e0e0" },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: "#9e9e9e" },
  switchText: { textAlign: "center", fontSize: 13, color: "#9e9e9e" },
  switchLink: { color: "#212121", fontWeight: "600" },
});