import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  type ViewStyle,
  type LayoutChangeEvent,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { haptics } from "@/utils/haptics";

interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  style?: ViewStyle;
}

export function SegmentedControl<T extends string>({
  options,
  activeId,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.id === activeId)
  );

  const segmentWidth = containerWidth > 0 ? (containerWidth - 6) / options.length : 0;

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const targetX = activeIndex * segmentWidth;

    if (isFirstRender.current) {
      translateX.setValue(targetX);
      isFirstRender.current = false;
    } else {
      Animated.spring(translateX, {
        toValue: targetX,
        tension: 250,
        friction: 22,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, segmentWidth, translateX]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
      if (isFirstRender.current) {
        const segW = (width - 6) / options.length;
        translateX.setValue(activeIndex * segW);
      }
    }
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.animatedPill,
            {
              width: segmentWidth,
              backgroundColor: colors.surfaceCard,
              transform: [{ translateX }],
            },
          ]}
        />
      )}
      {options.map((opt) => {
        const isActive = opt.id === activeId;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => {
              if (!isActive) {
                haptics.light();
                onChange(opt.id);
              }
            }}
            activeOpacity={0.8}
            style={styles.segment}
          >
            {opt.icon ? <View style={styles.icon}>{opt.icon}</View> : null}
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? colors.text : colors.textMuted,
                  fontWeight: isActive ? "600" : "500",
                },
              ]}
            >
              {opt.label}
            </Text>
            {opt.badge !== undefined ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isActive
                      ? colors.primaryLight
                      : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: isActive ? colors.primary : colors.textSubtle,
                    },
                  ]}
                >
                  {opt.badge}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    position: "relative",
  },
  animatedPill: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 9,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
    zIndex: 1,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 13,
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
