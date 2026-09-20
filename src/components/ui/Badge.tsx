import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface BadgeProps {
  label: string;
  variant?: "primary" | "accent" | "warning" | "danger" | "neutral" | "purple" | "info";
  size?: "sm" | "md";
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "neutral",
  size = "md",
  style,
}) => {
  const { colors, isDark } = useTheme();

  const getColors = () => {
    switch (variant) {
      case "primary":
        return { bg: colors.primaryLight, text: colors.primary };
      case "accent":
        return { bg: colors.accentLight, text: colors.accent };
      case "purple":
        return isDark
          ? { bg: "rgba(168, 85, 247, 0.22)", text: "#c084fc" }
          : { bg: "rgba(147, 51, 234, 0.12)", text: "#7c3aed" };
      case "info":
        return isDark
          ? { bg: "rgba(56, 189, 248, 0.2)", text: "#38bdf8" }
          : { bg: "rgba(2, 132, 199, 0.12)", text: "#0284c7" };
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
