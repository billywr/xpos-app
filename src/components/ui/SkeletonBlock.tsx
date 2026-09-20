import React, { useEffect, useRef } from "react";
import { Animated, type ViewStyle, type DimensionValue } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = "100%",
  height = 14,
  radius = 6,
  style,
}) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceRaised,
          opacity,
        },
        style,
      ]}
    />
  );
};
