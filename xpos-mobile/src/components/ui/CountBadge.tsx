import React from "react";
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from "react-native";
import { useTheme } from "@/context/ThemeContext";

export type CountBadgeVariant =
  | "neutral"
  | "primary"
  | "warning"
  | "purple"
  | "danger"
  | "accent";

export interface CountBadgeProps {
  count: number | string;
  variant?: CountBadgeVariant;
  active?: boolean;
  size?: "sm" | "md";
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  variant = "neutral",
  active = false,
  size = "md",
  style,
  textStyle,
}) => {
  const { colors, isDark } = useTheme();

  const getColors = () => {
    if (active) {
      switch (variant) {
        case "warning":
          return { bg: "rgba(255, 255, 255, 0.25)", text: "#fff" };
        case "purple":
          return { bg: "rgba(255, 255, 255, 0.25)", text: "#fff" };
        case "danger":
          return { bg: "rgba(255, 255, 255, 0.25)", text: "#fff" };
        case "primary":
          return { bg: "rgba(255, 255, 255, 0.25)", text: "#fff" };
        case "neutral":
        default:
          return {
            bg: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.15)",
            text: isDark ? "#fff" : colors.text,
          };
      }
    }

    switch (variant) {
      case "warning":
        return { bg: colors.warningLight, text: colors.warning };
      case "purple":
        return isDark
          ? { bg: "rgba(168, 85, 247, 0.22)", text: "#c084fc" }
          : { bg: "rgba(147, 51, 234, 0.12)", text: "#7c3aed" };
      case "primary":
        return { bg: colors.primaryLight, text: colors.primary };
      case "danger":
        return { bg: colors.dangerLight, text: colors.danger };
      case "accent":
        return { bg: colors.accentLight, text: colors.accent };
      case "neutral":
      default:
        return {
          bg: isDark ? "rgba(255, 255, 255, 0.15)" : colors.border,
          text: colors.textSecondary ?? colors.textMuted,
        };
    }
  };

  const { bg, text } = getColors();
  const isSm = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          height: isSm ? 18 : 20,
          minWidth: isSm ? 18 : 20,
          paddingHorizontal: isSm ? 4 : 6,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: text,
            fontSize: isSm ? 10 : 11,
          },
          textStyle,
        ]}
      >
        {count}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center",
  },
});
