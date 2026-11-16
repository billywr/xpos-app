import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { OrgProvider } from "@/context/OrgContext";
import { ToastProvider } from "@/context/ToastContext";
import { setDefaultApiBaseUrl } from "@/api/client";
import "@/utils/alertPolyfill";
import { getDatabase } from "@/db/database";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

function RootNavigation() {
  const { isDark, colors } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 17,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        {/* Main Authenticated Experience */}
        <Stack.Screen
          name="(app)"
          options={{
            headerShown: false,
          }}
        />

        {/* Authentication Flow */}
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
          }}
        />

        {/* Product Detail Modal */}
        <Stack.Screen
          name="product/[id]"
          options={{
            presentation: "modal",
            headerTitle: "Product Details",
            headerShown: true,
          }}
        />

        {/* Server Configuration Modal */}
        <Stack.Screen
          name="server-config"
          options={{
            presentation: "modal",
            headerTitle: "Server Configuration",
            headerShown: true,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Initialize local SQLite database on app mount
  useEffect(() => {
    void getDatabase();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <OrgProvider>
                <RootNavigation />
              </OrgProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
