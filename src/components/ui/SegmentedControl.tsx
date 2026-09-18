import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from "react-native";
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
        },
        style,
      ]}
    >
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
            style={[
              styles.segment,
              {
                backgroundColor: isActive ? colors.surfaceCard : "transparent",
                shadowColor: isActive ? "#000000" : "transparent",
                shadowOpacity: isActive ? 0.1 : 0,
                elevation: isActive ? 2 : 0,
              },
            ]}
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
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
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
