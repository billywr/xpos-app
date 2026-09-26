import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { ScalePressable } from "./ScalePressable";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "warning" | "danger" | "accent" | "neutral";
  style?: ViewStyle;
  onPress?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  variant = "neutral",
  style,
  onPress,
}) => {
  const { colors } = useTheme();

  const getVariantColor = () => {
    switch (variant) {
      case "primary":
        return colors.primary;
      case "warning":
        return colors.warning;
      case "danger":
        return colors.danger;
      case "accent":
        return colors.accent;
      default:
        return colors.text;
    }
  };

  const accentColor = getVariantColor();

  const cardContent = (
    <>
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
      </View>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSubtle }]}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );

  const containerStyle = [
    styles.container,
    {
      backgroundColor: colors.surfaceCard,
      borderColor: colors.border,
    },
    style,
  ];

  if (onPress) {
    return (
      <ScalePressable
        onPress={onPress}
        activeScale={0.98}
        accessibilityRole="button"
        style={containerStyle}
      >
        {cardContent}
      </ScalePressable>
    );
  }

  return <View style={containerStyle}>{cardContent}</View>;
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
  },
  icon: {
    opacity: 0.8,
  },
  value: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
