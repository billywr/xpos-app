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
import { storage } from "@/utils/storage";
import "@/utils/alertPolyfill";

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
  // Initialise the API client from persisted config on every app start / hot reload.
  // Without this the module-level default (production URL) is used until the first
  // call to setDefaultApiBaseUrl(), which never happens after a reload.
  useEffect(() => {
    void storage.getApiBaseUrl().then((url) => {
      if (url) setDefaultApiBaseUrl(url);
    });
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
