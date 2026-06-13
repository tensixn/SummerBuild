import { useState, useEffect } from "react";
import { View, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import HomeScreen from "./screens/HomeScreen";
import MapScreen from "./screens/MapScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import SearchScreen from "./screens/SearchScreen";
import { supabase } from "./lib/supabase";
import { ThemeContext, lightColors, darkColors } from "./lib/theme";
import { setupNotifications } from "./lib/notifications";

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
  const [pendingGameId, setPendingGameId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  function handleDeepLink(url: string | null) {
    if (!url) return;
    const match = url.match(/game\/([^/?#]+)/);
    if (match) { setTab("games"); setPendingGameId(match[1]); }
  }

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
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const remember = await AsyncStorage.getItem("@remember_me");
        if (remember === "0") {
          await supabase.auth.signOut();
          setLoggedIn(false);
        } else {
          setLoggedIn(true);
        }
      } else {
        setLoggedIn(false);
      }
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    setupNotifications();
    const notifSub = Notifications.addNotificationResponseReceivedListener(() => {
      setTab("games");
    });
    // Check if app was opened from a deep link
    Linking.getInitialURL().then(handleDeepLink);
    const linkSub = Linking.addEventListener("url", ({ url }) => handleDeepLink(url));
    return () => { notifSub.remove(); linkSub.remove(); };
  }, [loggedIn]);

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
          {tab === "games" ? <HomeScreen pendingGameId={pendingGameId} onGameOpened={() => setPendingGameId(null)} /> :
           tab === "map" ? <MapScreen /> :
           tab === "search" ? <SearchScreen /> :
           tab === "leaderboard" ? <LeaderboardScreen /> :
           <ProfileScreen />}
        </View>
        <View style={[styles.nav, { paddingBottom: insets.bottom || 8, backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
          <Pressable style={styles.navItem} onPress={() => setTab("games")}>
            <Ionicons name={tab === "games" ? "flash" : "flash-outline"} size={26} color={tab === "games" ? "#22c55e" : "#9e9e9e"} />
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("map")}>
            <Ionicons name={tab === "map" ? "map" : "map-outline"} size={26} color={tab === "map" ? "#22c55e" : "#9e9e9e"} />
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("search")}>
            <Ionicons name={tab === "search" ? "search" : "search-outline"} size={26} color={tab === "search" ? "#22c55e" : "#9e9e9e"} />
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("leaderboard")}>
            <Ionicons name={tab === "leaderboard" ? "trophy" : "trophy-outline"} size={26} color={tab === "leaderboard" ? "#22c55e" : "#9e9e9e"} />
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("profile")}>
            <Ionicons name={tab === "profile" ? "person" : "person-outline"} size={26} color={tab === "profile" ? "#22c55e" : "#9e9e9e"} />
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
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  navItem: { flex: 1, alignItems: "center", paddingBottom: 4 },
});
