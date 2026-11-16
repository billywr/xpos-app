import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FileSpreadsheet,
  Package,
  PackagePlus,
  HandCoins,
  TrendingUp,
  Settings,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { haptics } from "@/utils/haptics";

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isIos = Platform.OS === "ios";
  const bottomPadding = insets.bottom > 0 ? insets.bottom : (isIos ? 12 : 10);
  const tabBarHeight = 60 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 5,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          paddingHorizontal: 0,
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarIconStyle: {
          width: 20,
          height: 20,
          marginRight: 0,
          marginEnd: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: -2,
          marginStart: 3,
          marginLeft: 3,
        },
      }}
    >
      <Tabs.Screen
        name="stock"
        options={{
          title: "Stock",
          tabBarIcon: ({ color }) => (
            <FileSpreadsheet size={20} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => {
            haptics.light();
          },
        }}
      />

      <Tabs.Screen
        name="receiving"
        options={{
          title: "Receiving",
          tabBarIcon: ({ color }) => (
            <PackagePlus size={20} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => {
            haptics.light();
          },
        }}
      />

      <Tabs.Screen
        name="catalog"
        options={{
          title: "Catalog",
          tabBarIcon: ({ color }) => (
            <Package size={20} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => {
            haptics.light();
          },
        }}
      />

      <Tabs.Screen
        name="revenue"
        options={{
          title: "Revenue",
          tabBarIcon: ({ color }) => (
            <TrendingUp size={20} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => {
            haptics.light();
          },
        }}
      />

      <Tabs.Screen
        name="debts"
        options={{
          title: "Debts & Exp",
          tabBarIcon: ({ color }) => (
            <HandCoins size={20} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => {
            haptics.light();
          },
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Settings size={20} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => {
            haptics.light();
          },
        }}
      />
    </Tabs>
  );
}
