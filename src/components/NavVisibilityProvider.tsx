import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId } from "@/store/selectors/orgContextSelectors";
import { fetchNavVisibility, updateNavVisibility } from "@/api/navVisibility";
import { NavVisibilityContext } from "@/contexts/NavVisibilityContext";

const QUERY_KEY = "nav-visibility";

export function NavVisibilityProvider({ children }: { children: React.ReactNode }) {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const queryClient = useQueryClient();

  const enabled = Boolean(token && orgId);

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEY, token, orgId],
    queryFn: () => fetchNavVisibility(token, orgId!),
    enabled,
  });

  const mutation = useMutation({
    mutationFn: (payload: { admin: Record<string, boolean>; operator: Record<string, boolean> }) =>
      updateNavVisibility(token, orgId!, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData([QUERY_KEY, token, orgId], updated);
    },
  });

  const adminVisibility = data?.admin ?? {};
  const operatorVisibility = data?.operator ?? {};

  const setAdminVisible = useCallback(
    (path: string, visible: boolean) => {
      if (!orgId) return;
      const nextAdmin = { ...adminVisibility, [path]: visible };
      mutation.mutate({ admin: nextAdmin, operator: operatorVisibility });
    },
    [orgId, adminVisibility, operatorVisibility, mutation]
  );

  const setOperatorVisible = useCallback(
    (path: string, visible: boolean) => {
      if (!orgId) return;
      const nextOperator = { ...operatorVisibility, [path]: visible };
      mutation.mutate({ admin: adminVisibility, operator: nextOperator });
    },
    [orgId, adminVisibility, operatorVisibility, mutation]
  );

  const resetAdminToDefaults = useCallback(() => {
    if (!orgId) return;
    mutation.mutate({ admin: {}, operator: operatorVisibility });
  }, [orgId, operatorVisibility, mutation]);

  const resetOperatorToDefaults = useCallback(() => {
    if (!orgId) return;
    mutation.mutate({ admin: adminVisibility, operator: {} });
  }, [orgId, adminVisibility, mutation]);

  const value = {
    adminVisibility,
    operatorVisibility,
    setAdminVisible,
    setOperatorVisible,
    resetAdminToDefaults,
    resetOperatorToDefaults,
    isLoading: enabled && isLoading,
    isSaving: mutation.isPending,
    needsOrgSelection: !orgId,
  };

  return (
    <NavVisibilityContext.Provider value={value}>{children}</NavVisibilityContext.Provider>
  );
}
