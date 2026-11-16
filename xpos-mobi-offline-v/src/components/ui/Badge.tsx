import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, type ViewStyle } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface BadgeProps {
  label: string;
  variant?: "primary" | "accent" | "warning" | "danger" | "neutral" | "purple" | "info";
  size?: "sm" | "md";
  pulse?: boolean;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "neutral",
  size = "md",
  pulse = false,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) {
      pulseAnim.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, pulseAnim]);

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
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingHorizontal: size === "sm" ? 6 : 10,
          paddingVertical: size === "sm" ? 2 : 4,
          opacity: pulse ? pulseAnim : 1,
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
    </Animated.View>
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
