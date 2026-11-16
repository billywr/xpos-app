import React, { useEffect, useRef } from "react";
import {
  Animated,
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

export type ToastType = "success" | "error" | "info";

export interface ToastProps {
  visible: boolean;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  type,
  title,
  message,
  durationMs = 3200,
  onDismiss,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        dismiss();
      }, durationMs);
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, message, title, durationMs]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible && (opacity as any)._value === 0) {
    return null;
  }

  const getAccentColor = () => {
    switch (type) {
      case "success":
        return colors.primary;
      case "error":
        return colors.danger;
      case "info":
      default:
        return colors.accent;
    }
  };

  const getBgColor = () => {
    if (isDark) {
      switch (type) {
        case "success":
          return "rgba(16, 185, 129, 0.16)";
        case "error":
          return "rgba(224, 82, 82, 0.16)";
        case "info":
        default:
          return "rgba(59, 130, 246, 0.16)";
      }
    } else {
      switch (type) {
        case "success":
          return "#ecfdf5";
        case "error":
          return "#fef2f2";
        case "info":
        default:
          return "#eff6ff";
      }
    }
  };

  const renderIcon = () => {
    const iconColor = getAccentColor();
    switch (type) {
      case "success":
        return <CheckCircle2 size={20} color={iconColor} />;
      case "error":
        return <AlertCircle size={20} color={iconColor} />;
      case "info":
      default:
        return <Info size={20} color={iconColor} />;
    }
  };

  const accentColor = getAccentColor();
  const topOffset = Math.max(insets.top + (Platform.OS === "web" ? 16 : 8), 24);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={dismiss}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? colors.surfaceCard : colors.surface,
            borderColor: accentColor,
            shadowColor: accentColor,
          },
        ]}
      >
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: getBgColor() },
          ]}
        >
          {renderIcon()}
        </View>

        <View style={styles.textContainer}>
          {title ? (
            <Text
              style={[
                styles.title,
                { color: colors.text },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
          <Text
            style={[
              styles.message,
              { color: title ? colors.textMuted : colors.text },
            ]}
            numberOfLines={3}
          >
            {message}
          </Text>
        </View>

        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.closeBtn}
        >
          <X size={16} color={colors.textSubtle} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  closeBtn: {
    padding: 4,
  },
});
