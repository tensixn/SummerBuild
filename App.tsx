import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import HomeScreen from "./screens/HomeScreen";
import MapScreen from "./screens/MapScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import SearchScreen from "./screens/SearchScreen";
import { supabase } from "./lib/supabase";
import { ThemeContext, lightColors, darkColors } from "./lib/theme";

const DARK_KEY = "@dark_mode";

type Tab = "games" | "map" | "search" | "leaderboard" | "profile";
type AuthScreen = "login" | "signup";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [tab, setTab] = useState<Tab>("games");
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem(DARK_KEY).then((v) => { if (v === "1") setIsDark(true); });
  }, []);

  function toggle() {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(DARK_KEY, next ? "1" : "0");
      return next;
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const colors = isDark ? darkColors : lightColors;

  if (checking) return null;

  if (!loggedIn) {
    return (
      <ThemeContext.Provider value={{ isDark, toggle, colors }}>
        {authScreen === "login" ? (
          <LoginScreen onSwitch={() => setAuthScreen("signup")} onLogin={() => setLoggedIn(true)} />
        ) : (
          <SignupScreen onSwitch={() => setAuthScreen("login")} onSignup={() => setAuthScreen("login")} />
        )}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggle, colors }}>
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.content}>
          {tab === "games" ? <HomeScreen /> :
           tab === "map" ? <MapScreen /> :
           tab === "search" ? <SearchScreen /> :
           tab === "leaderboard" ? <LeaderboardScreen /> :
           <ProfileScreen />}
        </View>
        <View style={[styles.nav, { paddingBottom: insets.bottom || 8, backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
          <Pressable style={styles.navItem} onPress={() => setTab("games")}>
            <Text style={[styles.navIcon, tab === "games" && styles.navIconActive]}>⚡️</Text>
            <Text style={[styles.navLabel, tab === "games" && { color: colors.text }]}>Games</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("map")}>
            <Text style={[styles.navIcon, tab === "map" && styles.navIconActive]}>🗺</Text>
            <Text style={[styles.navLabel, tab === "map" && { color: colors.text }]}>Map</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("search")}>
            <Text style={[styles.navIcon, tab === "search" && styles.navIconActive]}>🔍</Text>
            <Text style={[styles.navLabel, tab === "search" && { color: colors.text }]}>Search</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("leaderboard")}>
            <Text style={[styles.navIcon, tab === "leaderboard" && styles.navIconActive]}>🏆</Text>
            <Text style={[styles.navLabel, tab === "leaderboard" && { color: colors.text }]}>Leaderboard</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("profile")}>
            <Text style={[styles.navIcon, tab === "profile" && styles.navIconActive]}>👤</Text>
            <Text style={[styles.navLabel, tab === "profile" && { color: colors.text }]}>Profile</Text>
          </Pressable>
        </View>
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  nav: {
    borderTopWidth: 1,
    flexDirection: "row",
    paddingVertical: 8,
  },
  navItem: { flex: 1, alignItems: "center", gap: 2 },
  navIcon: { fontSize: 22, opacity: 0.4 },
  navIconActive: { opacity: 1 },
  navLabel: { fontSize: 10, fontWeight: "500", color: "#bdbdbd", letterSpacing: 0.3 },
});
