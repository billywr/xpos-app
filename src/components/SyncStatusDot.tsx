import React, { useEffect, useRef } from "react";
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from "react-native";
import { useSyncStatus } from "@/services/useSyncStatus";
import { haptics } from "@/utils/haptics";

interface SyncStatusDotProps {
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

/**
 * Reusable animated sync status indicator dot with tap-to-sync capability.
 * - 🟢 Green (#10b981): Online & synchronized.
 * - 🟠 Amber (#f59e0b): Disconnected / offline.
 * - 🔴 Red (#ef4444): Active synchronization or pending queued mutations (pulsing).
 */
export const SyncStatusDot: React.FC<SyncStatusDotProps> = ({
  style,
  onPress,
}) => {
  const { isOnline, pendingCount, syncingCount, triggerSync } = useSyncStatus();

  const isSyncActive = syncingCount > 0 || pendingCount > 0 || !isOnline;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSyncActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.25,
            duration: 550,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 550,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      blinkAnim.setValue(1);
    }
  }, [isSyncActive, blinkAnim]);

  const handlePress = () => {
    haptics.light();
    triggerSync();
    if (onPress) onPress();
  };

  const dotColor = !isOnline
    ? "#f59e0b"
    : isSyncActive
    ? "#ef4444"
    : "#10b981";

  const accessibilityLabel = !isOnline
    ? "Offline - pending mutations"
    : isSyncActive
    ? "Syncing in progress"
    : "Sync completed";

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.6}
      hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.hitBox, style]}
    >
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: dotColor,
            opacity: blinkAnim,
            transform: [
              {
                scale: blinkAnim.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0.85, 1.15],
                }),
              },
            ],
          },
        ]}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  hitBox: {
    paddingHorizontal: 4,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
