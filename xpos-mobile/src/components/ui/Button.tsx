import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { haptics } from "@/utils/haptics";
import { ScalePressable } from "./ScalePressable";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const { colors } = useTheme();

  const handlePress = () => {
    if (disabled || loading) return;
    haptics.light();
    onPress();
  };

  const getBackgroundColor = () => {
    if (disabled) return colors.surfaceRaised;
    switch (variant) {
      case "primary":
        return colors.primary;
      case "secondary":
        return colors.surfaceRaised;
      case "danger":
        return colors.danger;
      case "outline":
      case "ghost":
        return "transparent";
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textSubtle;
    switch (variant) {
      case "primary":
      case "danger":
        return "#ffffff";
      case "secondary":
        return colors.text;
      case "outline":
        return colors.primary;
      case "ghost":
        return colors.textMuted;
    }
  };

  const getBorderColor = () => {
    if (variant === "outline") return colors.border;
    return "transparent";
  };

  const paddingVertical = size === "sm" ? 8 : size === "lg" ? 16 : 12;
  const paddingHorizontal = size === "sm" ? 12 : size === "lg" ? 24 : 16;
  const fontSize = size === "sm" ? 13 : size === "lg" ? 16 : 14;

  return (
    <ScalePressable
      onPress={handlePress}
      disabled={disabled || loading}
      activeScale={0.965}
      style={[
        styles.btn,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === "outline" ? 1 : 0,
          paddingVertical,
          paddingHorizontal,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#ffffff" : colors.primary}
        />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize,
                marginLeft: icon ? 8 : 0,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </ScalePressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  text: {
    fontWeight: "600",
  },
});
