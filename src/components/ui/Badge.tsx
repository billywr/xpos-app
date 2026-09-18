import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface BadgeProps {
  label: string;
  variant?: "primary" | "accent" | "warning" | "danger" | "neutral";
  size?: "sm" | "md";
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "neutral",
  size = "md",
  style,
}) => {
  const { colors } = useTheme();

  const getColors = () => {
    switch (variant) {
      case "primary":
        return { bg: colors.primaryLight, text: colors.primary };
      case "accent":
        return { bg: colors.accentLight, text: colors.accent };
      case "warning":
        return { bg: colors.warningLight, text: colors.warning };
      case "danger":
        return { bg: colors.dangerLight, text: colors.danger };
      case "neutral":
      default:
        return { bg: colors.surfaceRaised, text: colors.textMuted };
    }
  };

  const { bg, text } = getColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingHorizontal: size === "sm" ? 6 : 10,
          paddingVertical: size === "sm" ? 2 : 4,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: text,
            fontSize: size === "sm" ? 11 : 12,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "600",
  },
});
