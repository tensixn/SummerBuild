import { useState, useMemo } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, Alert, TouchableOpacity,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { supabase } from "../lib/supabase";
import { useTheme, Colors } from "../lib/theme";

export default function SignupScreen({ onSwitch, onSignup }: {
  onSwitch: () => void;
  onSignup: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match!");
      return;
    }
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
    <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
    >
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join NTU Sports today</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor={colors.placeholder}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
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

      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Confirm Password"
          placeholderTextColor={colors.placeholder}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirm}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(p => !p)}>
          <Text style={styles.eyeIcon}>{showConfirm ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>

      <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSignup} disabled={loading}>
        <Text style={styles.btnText}>{loading ? "Creating account..." : "Sign up"}</Text>
      </Pressable>

      <Pressable onPress={onSwitch}>
        <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Sign in</Text></Text>
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
    switchText: { textAlign: "center", fontSize: 13, color: c.textFaint },
    switchLink: { color: c.text, fontWeight: "600" },
  });
}
