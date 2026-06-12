import { View, Image, Text, ViewStyle } from "react-native";
import { AVATAR_BORDERS } from "../lib/borders";

type Props = {
  avatarUrl?: string | null;
  initial?: string;
  equippedBorderId?: string | null;
  size?: "large" | "small";
  style?: ViewStyle;
};

// outer: frame container size  avatar: photo circle size  offset: (outer-avatar)/2
const CONFIGS = {
  large: { outer: 110, avatar: 80, offset: 15, radius: 40, fontSize: 32 },
  small: { outer: 62,  avatar: 44, offset:  9, radius: 22, fontSize: 18 },
};


export default function AvatarWithFrame({ avatarUrl, initial, equippedBorderId, size = "large", style }: Props) {
  const cfg = CONFIGS[size];
  const border = equippedBorderId ? AVATAR_BORDERS.find((b) => b.id === equippedBorderId) : null;

  const outerSize = border ? cfg.outer : cfg.avatar;
  const avatarOffset = border ? cfg.offset : 0;

  return (
    <View style={[{ width: outerSize, height: outerSize }, style]}>
      {/* Avatar circle — rendered first so it sits behind the frame */}
      <View
        style={{
          position: "absolute",
          top: avatarOffset,
          left: avatarOffset,
          width: cfg.avatar,
          height: cfg.avatar,
          borderRadius: cfg.radius,
          overflow: "hidden",
        }}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: "#212121", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: cfg.fontSize, fontWeight: "700", color: "#fff" }}>
              {(initial ?? "?")[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Frame image — fills the full outer container, rendered on top */}
      {border && (
        <Image
          source={{ uri: border.image }}
          style={{ width: outerSize, height: outerSize }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}
