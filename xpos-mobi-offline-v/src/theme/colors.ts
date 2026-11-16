export const darkColors = {
  background: "#090d16",
  surface: "#111827",
  surfaceCard: "#1e293b",
  surfaceRaised: "#334155",
  border: "#334155",
  borderSubtle: "#1e293b",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textSubtle: "#64748b",

  primary: "#10b981", // Emerald positive accent
  primaryHover: "#059669",
  primaryLight: "rgba(16, 185, 129, 0.15)",

  accent: "#3b82f6", // Royal Blue
  accentLight: "rgba(59, 130, 246, 0.15)",

  warning: "#f59e0b", // Amber
  warningLight: "rgba(245, 158, 11, 0.15)",

  danger: "#e05252", // Soft brick red — muted, readable
  dangerLight: "rgba(224, 82, 82, 0.12)",

  success: "#10b981",
  successLight: "rgba(16, 185, 129, 0.15)",

  tabBarBg: "#0d1322",
  tabBarBorder: "#1e293b",
  tabBarActive: "#10b981",
  tabBarInactive: "#64748b",
};

export const lightColors = {
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceCard: "#ffffff",
  surfaceRaised: "#f1f5f9",
  border: "#e2e8f0",
  borderSubtle: "#f1f5f9",
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",

  primary: "#059669",
  primaryHover: "#047857",
  primaryLight: "rgba(5, 150, 105, 0.1)",

  accent: "#2563eb",
  accentLight: "rgba(37, 99, 235, 0.1)",

  warning: "#d97706",
  warningLight: "rgba(217, 119, 6, 0.1)",

  danger: "#c0392b", // Calm warm red — less vivid on white
  dangerLight: "rgba(192, 57, 43, 0.10)",

  success: "#059669",
  successLight: "rgba(5, 150, 105, 0.1)",

  tabBarBg: "#ffffff",
  tabBarBorder: "#e2e8f0",
  tabBarActive: "#059669",
  tabBarInactive: "#94a3b8",
};

export type ThemeColors = typeof darkColors;
