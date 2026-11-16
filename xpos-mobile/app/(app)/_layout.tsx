import React, { useEffect } from "react";
import { Stack, Redirect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { syncScheduler } from "@/services/syncScheduler";

export default function AppLayout() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const { orgId, branchId } = useOrg();
  const queryClient = useQueryClient();

  useEffect(() => {
    syncScheduler.init(queryClient);
  }, [queryClient]);

  useEffect(() => {
    if (token && orgId && branchId) {
      syncScheduler.setContext({ token, orgId, branchId });
    } else {
      syncScheduler.setContext(null);
    }
  }, [token, orgId, branchId]);

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
