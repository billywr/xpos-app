import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type GestureResponderEvent,
} from "react-native";

export interface ScalePressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  tension?: number;
  friction?: number;
  children: React.ReactNode;
}

export const ScalePressable: React.FC<ScalePressableProps> = ({
  style,
  activeScale = 0.965,
  tension = 300,
  friction = 20,
  children,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: activeScale,
        tension,
        friction,
        useNativeDriver: true,
      }).start();
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension,
        friction,
        useNativeDriver: true,
      }).start();
    }
    onPressOut?.(e);
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};
