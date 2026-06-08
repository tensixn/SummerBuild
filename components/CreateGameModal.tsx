import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../lib/supabase";
import { NTU_LOCATIONS, SKILL_LEVELS, SPORTS, Sport } from "../lib/types";
import { useTheme, Colors } from "../lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const SPORT_OPTIONS = SPORTS.filter((s) => s !== "All") as Exclude<Sport, "All">[];

function roundTo15(date: Date): Date {
  const d = new Date(date);
  const m = d.getMinutes();
  const rounded = Math.ceil(m / 15) * 15;
  if (rounded === 60) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setMinutes(rounded, 0, 0);
  }
  return d;
}

function defaultStart() {
  return roundTo15(new Date(Date.now() + 2 * 60 * 60 * 1000));
}

function defaultEnd(start: Date) {
  return new Date(start.getTime() + 60 * 60 * 1000);
}

export default function CreateGameModal({ visible, onClose, onCreated }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sport, setSport] = useState<string>("Badminton");
  const [location, setLocation] = useState<string>(NTU_LOCATIONS[0]);
  const [startTime, setStartTime] = useState<Date>(defaultStart);
  const [endTime, setEndTime] = useState<Date>(() => defaultEnd(defaultStart()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
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
    if (startTime.getTime() <= Date.now()) {
      Alert.alert("Invalid", "Start time must be in the future.");
      return;
    }
    if (endTime.getTime() <= startTime.getTime()) {
      Alert.alert("Invalid", "End time must be after start time.");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Ensure profile exists so creator_username shows on the card
    if (user) {
      await supabase.from("profiles").upsert(
        { id: user.id, username: user.email?.split("@")[0] ?? "Player", sports_interests: [], avatar_url: null },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }
    const { data: gameData, error } = await supabase
      .from("games")
      .insert({
        sport,
        location,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        max_players: max,
        skill_level: skillLevel,
        description: description.trim() || null,
        status: "open",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    setLoading(false);

    if (error || !gameData) {
      Alert.alert("Error", error?.message ?? "Failed to create game.");
      return;
    }

    if (user?.email) {
      const { error: joinError } = await supabase
        .from("game_participants")
        .insert({ game_id: gameData.id, user_name: user.email, user_id: user.id });
      if (joinError) Alert.alert("Auto-join error", joinError.message);
    }

    const fresh = defaultStart();
    setDescription("");
    setStartTime(fresh);
    setEndTime(defaultEnd(fresh));
    setShowDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndTimePicker(false);
    onCreated();
    onClose();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  function formatDate(d: Date) {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime12(d: Date) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function onDateChange(_: any, selected?: Date) {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (!selected) return;
    // Keep the same date for both start and end
    const updatedStart = new Date(startTime);
    updatedStart.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setStartTime(updatedStart);

    const updatedEnd = new Date(endTime);
    updatedEnd.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setEndTime(updatedEnd);
  }

  function onStartTimeChange(_: any, selected?: Date) {
    if (Platform.OS === "android") setShowStartTimePicker(false);
    if (!selected) return;
    const updated = new Date(startTime);
    updated.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setStartTime(updated);
    if (endTime.getTime() <= updated.getTime()) {
      setEndTime(new Date(updated.getTime() + 60 * 60 * 1000));
    }
  }

  function onEndTimeChange(_: any, selected?: Date) {
    if (Platform.OS === "android") setShowEndTimePicker(false);
    if (!selected) return;
    const updated = new Date(endTime);
    updated.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setEndTime(updated);
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
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* ── Date ── */}
        <Text style={styles.label}>Date</Text>
        <Pressable
          style={styles.dateBtn}
          onPress={() => setShowDatePicker((v) => !v)}
        >
          <Text style={styles.dateBtnText}>{formatDate(startTime)}</Text>
          <Text style={styles.dateBtnCaret}>{showDatePicker ? "▲" : "▼"}</Text>
        </Pressable>

        {showDatePicker && (
          <View style={styles.datePickerWrapper}>
            <DateTimePicker
              value={startTime}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "calendar"}
              minimumDate={today}
              maximumDate={maxDate}
              onChange={onDateChange}
              style={styles.iosDatePicker}
            />
            {Platform.OS === "ios" && (
              <Pressable style={styles.dateDoneBtn} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.dateDoneBtnText}>Done</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Start & End Time ── */}
        <Text style={styles.label}>Time</Text>
        <View style={styles.timeCard}>
          <View style={styles.timeRow}>
            <Text style={styles.timeRowLabel}>Start</Text>
            {Platform.OS === "ios" ? (
              <DateTimePicker
                value={startTime}
                mode="time"
                display="compact"
                minuteInterval={1}
                onChange={onStartTimeChange}
                themeVariant="light"
              />
            ) : (
              <Pressable
                style={styles.androidTimeBtn}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={styles.androidTimeBtnText}>{formatTime12(startTime)}</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.timeDivider} />
          <View style={styles.timeRow}>
            <Text style={styles.timeRowLabel}>End</Text>
            {Platform.OS === "ios" ? (
              <DateTimePicker
                value={endTime}
                mode="time"
                display="compact"
                minuteInterval={1}
                onChange={onEndTimeChange}
                themeVariant="light"
              />
            ) : (
              <Pressable
                style={styles.androidTimeBtn}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={styles.androidTimeBtnText}>{formatTime12(endTime)}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Android time picker dialogs — rendered outside the card to avoid layout issues */}
        {Platform.OS === "android" && showStartTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display="clock"
            minuteInterval={1}
            onChange={onStartTimeChange}
          />
        )}
        {Platform.OS === "android" && showEndTimePicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display="clock"
            minuteInterval={1}
            onChange={onEndTimeChange}
          />
        )}

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
          placeholderTextColor={colors.placeholder}
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

function makeStyles(c: Colors) { return StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
    backgroundColor: c.bg,
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
    color: c.text,
  },
  cancelText: {
    fontSize: 16,
    color: c.textMuted,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: c.textFaint,
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
    borderColor: c.border,
  },
  optionChipActive: {
    backgroundColor: "#212121",
    borderColor: "#212121",
  },
  optionText: {
    fontSize: 13,
    color: c.textSub,
  },
  optionTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  dateBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.input,
  },
  dateBtnText: {
    fontSize: 15,
    color: c.text,
    fontWeight: "500",
  },
  dateBtnCaret: {
    fontSize: 11,
    color: c.textFaint,
  },
  datePickerWrapper: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  iosDatePicker: {
    height: 180,
  },
  dateDoneBtn: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
  },
  dateDoneBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: c.text,
  },
  timeCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.input,
    overflow: "hidden",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timeRowLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: c.textSub,
  },
  timeDivider: {
    height: 1,
    backgroundColor: c.borderLight,
    marginHorizontal: 14,
  },
  androidTimeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  androidTimeBtnText: {
    fontSize: 15,
    fontWeight: "500",
    color: c.text,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.input,
  },
  inputMulti: {
    height: 80,
    textAlignVertical: "top",
  },
  createBtn: {
    backgroundColor: c.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  createBtnDisabled: {
    backgroundColor: "#bdbdbd",
  },
  createBtnText: {
    color: c.primaryText,
    fontSize: 16,
    fontWeight: "700",
  },
}); }
