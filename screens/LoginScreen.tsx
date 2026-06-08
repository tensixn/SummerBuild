import { useState, useMemo } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, Platform, Alert, TouchableOpacity,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { useTheme, Colors } from "../lib/theme";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ onSwitch, onLogin }: {
  onSwitch: () => void;
  onLogin: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
      if (result.type === "success") {
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.replace("#", ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
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
    <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
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
        placeholderTextColor={colors.placeholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor={colors.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
          <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>

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
    </KeyboardAwareScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: c.bg },
    title: { fontSize: 28, fontWeight: "700", color: c.text, marginBottom: 6, textAlign: "center" },
    subtitle: { fontSize: 14, color: c.textFaint, marginBottom: 32, textAlign: "center" },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 14, fontSize: 15, marginBottom: 14, backgroundColor: c.input, color: c.text,
    },
    passwordRow: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      backgroundColor: c.input, marginBottom: 14,
    },
    passwordInput: { flex: 1, padding: 14, fontSize: 15, color: c.text },
    eyeBtn: { paddingHorizontal: 14 },
    eyeIcon: { fontSize: 18 },
    btn: {
      backgroundColor: c.primary, borderRadius: 10,
      padding: 16, alignItems: "center", marginBottom: 16,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: c.primaryText, fontSize: 15, fontWeight: "600" },
    googleBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 14, marginBottom: 16, backgroundColor: c.surface, gap: 10,
    },
    googleIcon: { fontSize: 16, fontWeight: "700", color: "#4285F4" },
    googleBtnText: { fontSize: 15, fontWeight: "600", color: c.text },
    dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerText: { marginHorizontal: 12, fontSize: 12, color: c.textFaint },
    switchText: { textAlign: "center", fontSize: 13, color: c.textFaint },
    switchLink: { color: c.text, fontWeight: "600" },
  });
}
