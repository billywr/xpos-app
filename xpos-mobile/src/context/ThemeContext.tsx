import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type ThemeColors } from "@/theme/colors";

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setThemeMode: (mode: "dark" | "light" | "system") => void;
  themeMode: "dark" | "light" | "system";
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
  setThemeMode: () => {},
  themeMode: "dark",
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<"dark" | "light" | "system">("dark");

  useEffect(() => {
    AsyncStorage.getItem("@xpos:theme_mode").then((stored) => {
      if (stored === "dark" || stored === "light" || stored === "system") {
        setThemeModeState(stored);
      }
    });
  }, []);

  const setThemeMode = (mode: "dark" | "light" | "system") => {
    setThemeModeState(mode);
    void AsyncStorage.setItem("@xpos:theme_mode", mode);
  };

  const isDark =
    themeMode === "system" ? systemScheme === "dark" : themeMode === "dark";

  const colors = isDark ? darkColors : lightColors;

  const toggleTheme = () => {
    setThemeMode(isDark ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider
      value={{ isDark, colors, toggleTheme, setThemeMode, themeMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
