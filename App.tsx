import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Package,
  HandCoins,
  Settings,
} from "lucide-react-native";

import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OrgProvider } from "@/context/OrgContext";
import { LoginScreen } from "@/screens/LoginScreen";
import { StockCountScreen } from "@/screens/StockCountScreen";
import { CatalogScreen } from "@/screens/CatalogScreen";
import { DebtsExpensesScreen } from "@/screens/DebtsExpensesScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { haptics } from "@/utils/haptics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

type TabType = "stock" | "catalog" | "debts" | "settings";

function MainNavigator() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>("stock");
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const renderScreen = () => {
    switch (currentTab) {
      case "stock":
        return <StockCountScreen />;
      case "catalog":
        return <CatalogScreen />;
      case "debts":
        return <DebtsExpensesScreen />;
      case "settings":
        return <SettingsScreen />;
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: "stock",
      label: "Stock Count",
      icon: (
        <FileSpreadsheet
          size={20}
          color={currentTab === "stock" ? colors.tabBarActive : colors.tabBarInactive}
        />
      ),
    },
    {
      id: "catalog",
      label: "Catalog",
      icon: (
        <Package
          size={20}
          color={
            currentTab === "catalog" ? colors.tabBarActive : colors.tabBarInactive
          }
        />
      ),
    },
    {
      id: "debts",
      label: "Debts & Exp",
      icon: (
        <HandCoins
          size={20}
          color={currentTab === "debts" ? colors.tabBarActive : colors.tabBarInactive}
        />
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
        <Settings
          size={20}
          color={
            currentTab === "settings" ? colors.tabBarActive : colors.tabBarInactive
          }
        />
      ),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Tactile Bottom Navigation Bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.tabBarBorder,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === currentTab;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                haptics.light();
                setCurrentTab(tab.id);
              }}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <View
                style={[
                  styles.tabIconBox,
                  {
                    backgroundColor: isActive
                      ? colors.primaryLight
                      : "transparent",
                  },
                ]}
              >
                {tab.icon}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive
                      ? colors.tabBarActive
                      : colors.tabBarInactive,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <OrgProvider>
              <MainNavigator />
            </OrgProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  tabIconBox: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
