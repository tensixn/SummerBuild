import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./screens/HomeScreen";
import MapScreen from "./screens/MapScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import SearchScreen from "./screens/SearchScreen";
import { supabase } from "./lib/supabase";

type Tab = "games" | "map" | "profile" | "search"; // ← only one declaration
type AuthScreen = "login" | "signup";

export default function App() {
  const [tab, setTab] = useState<Tab>("games");
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

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

  if (checking) return null;

  if (!loggedIn) {
    return authScreen === "login" ? (
      <LoginScreen onSwitch={() => setAuthScreen("signup")} onLogin={() => setLoggedIn(true)} />
    ) : (
      <SignupScreen onSwitch={() => setAuthScreen("login")} onSignup={() => setAuthScreen("login")} />
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {tab === "games" ? <HomeScreen /> :
         tab === "map" ? <MapScreen /> :
         tab === "search" ? <SearchScreen /> :
         <ProfileScreen />}
      </View>
      <SafeAreaView style={styles.navSafe}>
        <View style={styles.nav}>
          <Pressable style={styles.navItem} onPress={() => setTab("games")}>
            <Text style={[styles.navIcon, tab === "games" && styles.navIconActive]}>⚡️</Text>
            <Text style={[styles.navLabel, tab === "games" && styles.navLabelActive]}>Games</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("map")}>
            <Text style={[styles.navIcon, tab === "map" && styles.navIconActive]}>🗺</Text>
            <Text style={[styles.navLabel, tab === "map" && styles.navLabelActive]}>Map</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("search")}>  {/* ← added */}
            <Text style={[styles.navIcon, tab === "search" && styles.navIconActive]}>🔍</Text>
            <Text style={[styles.navLabel, tab === "search" && styles.navLabelActive]}>Search</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setTab("profile")}>
            <Text style={[styles.navIcon, tab === "profile" && styles.navIconActive]}>👤</Text>
            <Text style={[styles.navLabel, tab === "profile" && styles.navLabelActive]}>Profile</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => supabase.auth.signOut()}>
            <Text style={styles.navIcon}>🚪</Text>
            <Text style={styles.navLabel}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  content: { flex: 1 },
  navSafe: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  nav: { flexDirection: "row", paddingVertical: 8 },
  navItem: { flex: 1, alignItems: "center", gap: 2 },
  navIcon: { fontSize: 22, opacity: 0.4 },
  navIconActive: { opacity: 1 },
  navLabel: { fontSize: 10, fontWeight: "500", color: "#bdbdbd", letterSpacing: 0.3 },
  navLabelActive: { color: "#212121" },
});