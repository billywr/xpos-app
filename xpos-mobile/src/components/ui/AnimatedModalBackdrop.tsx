import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/utils/haptics";

interface AnimatedModalBackdropProps {
  children: React.ReactNode;
  onPressBackdrop?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  applySafeAreaBottom?: boolean;
}

export const AnimatedModalBackdrop: React.FC<AnimatedModalBackdropProps> = ({
  children,
  onPressBackdrop,
  style,
  contentStyle,
  applySafeAreaBottom = true,
}) => {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const handleBackdropPress = () => {
    if (onPressBackdrop) {
      haptics.light();
      onPressBackdrop();
    }
  };

  const flattenedStyle = StyleSheet.flatten(style);
  const isCentered = flattenedStyle?.justifyContent === "center";
  const shouldApplySafeArea = applySafeAreaBottom && !isCentered;

  return (
    <Animated.View style={[styles.backdrop, { opacity }, style]}>
      {onPressBackdrop && (
        <TouchableWithoutFeedback onPress={handleBackdropPress} accessible={false}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}
      <View
        onStartShouldSetResponder={() => true}
        style={[
          styles.contentWrapper,
          shouldApplySafeArea && {
            paddingBottom: Math.max(insets.bottom, 16),
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  contentWrapper: {
    width: "100%",
  },
});
