import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";

// On web, inject global style for autofill so Chrome doesn't break dark theme
if (Platform.OS === "web" && typeof document !== "undefined") {
  const styleId = "xpos-input-autofill-styles";
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.innerHTML = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover, 
      input:-webkit-autofill:focus, 
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 1000px #1e293b inset !important;
        -webkit-text-fill-color: #f8fafc !important;
        caret-color: #f8fafc !important;
        transition: background-color 5000s ease-in-out 0s;
      }
      input {
        outline: none !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputWrapperStyle?: StyleProp<ViewStyle>;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      containerStyle,
      inputWrapperStyle,
      style,
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? (
          <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        ) : null}
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: error ? colors.danger : colors.border,
            },
            inputWrapperStyle,
          ]}
        >
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <TextInput
            ref={ref}
          placeholderTextColor={colors.textSubtle}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: "transparent",
            },
            Platform.OS === "web"
              ? ({
                  outlineStyle: "none",
                } as any)
              : {},
            style,
          ]}
          {...props}
        />
        {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
});

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    height: "100%",
    backgroundColor: "transparent",
  },
  iconLeft: {
    marginRight: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconRight: {
    marginLeft: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
});
