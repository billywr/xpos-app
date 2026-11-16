import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "elevated" | "outlined";
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = "default",
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceCard,
          borderColor: colors.border,
          borderWidth: variant === "outlined" ? 1 : 0.5,
          shadowColor: isDark ? "#000000" : "#64748b",
          shadowOpacity: variant === "elevated" ? 0.15 : 0.05,
          shadowRadius: variant === "elevated" ? 8 : 4,
          elevation: variant === "elevated" ? 3 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
  },
});
