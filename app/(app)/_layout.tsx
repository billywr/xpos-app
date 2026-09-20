import React from "react";
import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // If unauthenticated, redirect to login
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
