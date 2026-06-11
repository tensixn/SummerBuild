import { Pressable, Text, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme";

export default function CloseButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.btn, { backgroundColor: colors.borderLight }]}
    >
      <Text style={[styles.icon, { color: colors.textMuted }]}>✕</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
});
