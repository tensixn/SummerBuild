import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";
import { NTU_LOCATIONS, SKILL_LEVELS, SPORTS, Sport } from "../lib/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const SPORT_OPTIONS = SPORTS.filter((s) => s !== "All") as Exclude<Sport, "All">[];

export default function CreateGameModal({ visible, onClose, onCreated }: Props) {
  const [sport, setSport] = useState<string>("Badminton");
  const [location, setLocation] = useState<string>(NTU_LOCATIONS[0]);
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [skillLevel, setSkillLevel] = useState("Chill");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const max = parseInt(maxPlayers);
    if (!max || max < 2 || max > 22) {
      Alert.alert("Invalid", "Max players must be between 2 and 22.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("games").insert({
      sport,
      location,
      start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      max_players: max,
      skill_level: skillLevel,
      description: description.trim() || null,
      status: "open",
    });
    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setDescription("");
    onCreated();
    onClose();
  }

  function OptionRow({
    options,
    value,
    onSelect,
  }: {
    options: string[];
    value: string;
    onSelect: (v: string) => void;
  }) {
    return (
      <View style={styles.optionRow}>
        {options.map((o) => (
          <Pressable
            key={o}
            style={[styles.optionChip, value === o && styles.optionChipActive]}
            onPress={() => onSelect(o)}
          >
            <Text style={[styles.optionText, value === o && styles.optionTextActive]}>
              {o}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Create a game</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Sport</Text>
        <OptionRow options={SPORT_OPTIONS} value={sport} onSelect={setSport} />

        <Text style={styles.label}>Location</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          <View style={styles.optionRow}>
            {NTU_LOCATIONS.map((loc) => (
              <Pressable
                key={loc}
                style={[styles.optionChip, location === loc && styles.optionChipActive]}
                onPress={() => setLocation(loc)}
              >
                <Text style={[styles.optionText, location === loc && styles.optionTextActive]}>
                  {loc}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>Skill level</Text>
        <OptionRow options={SKILL_LEVELS} value={skillLevel} onSelect={setSkillLevel} />

        <Text style={styles.label}>Max players</Text>
        <TextInput
          style={styles.input}
          value={maxPlayers}
          onChangeText={setMaxPlayers}
          keyboardType="number-pad"
          maxLength={2}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Need 2 more for doubles"
          placeholderTextColor="#9e9e9e"
          multiline
          maxLength={120}
        />

        <Pressable
          style={[styles.createBtn, loading && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.createBtnText}>
            {loading ? "Creating..." : "Create game"}
          </Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#212121",
  },
  cancelText: {
    fontSize: 16,
    color: "#757575",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#9e9e9e",
    marginBottom: 8,
    marginTop: 20,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hScroll: {
    marginBottom: 4,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  optionChipActive: {
    backgroundColor: "#212121",
    borderColor: "#212121",
  },
  optionText: {
    fontSize: 13,
    color: "#424242",
  },
  optionTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#212121",
    backgroundColor: "#fafafa",
  },
  inputMulti: {
    height: 80,
    textAlignVertical: "top",
  },
  createBtn: {
    backgroundColor: "#212121",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  createBtnDisabled: {
    backgroundColor: "#bdbdbd",
  },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});