import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function SignupScreen({ onSwitch, onSignup }: {
  onSwitch: () => void;
  onSignup: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) Alert.alert("Error", error.message);
    else {
      Alert.alert("Success", "Account created! You can now sign in.");
      onSwitch();
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join NTU Sports today</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
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

      <Pressable style={styles.btn} onPress={handleSignup} disabled={loading}>
        <Text style={styles.btnText}>{loading ? "Creating account..." : "Sign up"}</Text>
      </Pressable>

      <Pressable onPress={onSwitch}>
        <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Sign in</Text></Text>
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
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  switchText: { textAlign: "center", fontSize: 13, color: "#9e9e9e" },
  switchLink: { color: "#212121", fontWeight: "600" },
});