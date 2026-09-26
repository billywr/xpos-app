import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
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

  const flattened = (StyleSheet.flatten(style) || {}) as ViewStyle;
  const {
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    alignSelf,
    width,
    minWidth,
    maxWidth,
    position,
    top,
    bottom,
    left,
    right,
    zIndex,
    ...viewStyle
  } = flattened;

  const pressableLayout: ViewStyle = {
    ...(flex !== undefined ? { flex } : {}),
    ...(flexGrow !== undefined ? { flexGrow } : {}),
    ...(flexShrink !== undefined ? { flexShrink } : {}),
    ...(flexBasis !== undefined ? { flexBasis } : {}),
    ...(margin !== undefined ? { margin } : {}),
    ...(marginTop !== undefined ? { marginTop } : {}),
    ...(marginBottom !== undefined ? { marginBottom } : {}),
    ...(marginLeft !== undefined ? { marginLeft } : {}),
    ...(marginRight !== undefined ? { marginRight } : {}),
    ...(marginHorizontal !== undefined ? { marginHorizontal } : {}),
    ...(marginVertical !== undefined ? { marginVertical } : {}),
    ...(alignSelf !== undefined ? { alignSelf } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(minWidth !== undefined ? { minWidth } : {}),
    ...(maxWidth !== undefined ? { maxWidth } : {}),
    ...(position !== undefined ? { position } : {}),
    ...(top !== undefined ? { top } : {}),
    ...(bottom !== undefined ? { bottom } : {}),
    ...(left !== undefined ? { left } : {}),
    ...(right !== undefined ? { right } : {}),
    ...(zIndex !== undefined ? { zIndex } : {}),
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={pressableLayout}
      {...rest}
    >
      <Animated.View
        style={[
          viewStyle,
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
