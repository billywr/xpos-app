import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId } from "@/store/selectors/orgContextSelectors";
import { fetchNavVisibility, updateNavVisibility } from "@/api/navVisibility";
import { APP_NAME_KEY, LOGO_KEY } from "@/config/headerNavItems";
import { setStoredBranding } from "@/utils/brandingStorage";
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
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (payload: {
      admin: Record<string, boolean>;
      operator: Record<string, boolean>;
      header: Record<string, boolean>;
      adminLabels: Record<string, string>;
      operatorLabels: Record<string, string>;
      headerLabels: Record<string, string>;
    }) => updateNavVisibility(token, orgId!, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData([QUERY_KEY, token, orgId], updated);
    },
  });

  const adminVisibility = data?.admin ?? {};
  const operatorVisibility = data?.operator ?? {};
  const headerVisibility = data?.header ?? {};
  const adminLabels = data?.adminLabels ?? {};
  const operatorLabels = data?.operatorLabels ?? {};
  const headerLabels = data?.headerLabels ?? {};

  const setAdminVisible = useCallback(
    (path: string, visible: boolean) => {
      if (!orgId) return;
      const nextAdmin = { ...adminVisibility, [path]: visible };
      mutation.mutate({
        admin: nextAdmin,
        operator: operatorVisibility,
        header: headerVisibility,
        adminLabels,
        operatorLabels,
        headerLabels,
      });
    },
    [
      orgId,
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      mutation,
    ]
  );

  const setOperatorVisible = useCallback(
    (path: string, visible: boolean) => {
      if (!orgId) return;
      const nextOperator = { ...operatorVisibility, [path]: visible };
      mutation.mutate({
        admin: adminVisibility,
        operator: nextOperator,
        header: headerVisibility,
        adminLabels,
        operatorLabels,
        headerLabels,
      });
    },
    [
      orgId,
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      mutation,
    ]
  );

  const setHeaderVisible = useCallback(
    (path: string, visible: boolean) => {
      if (!orgId) return;
      const nextHeader = { ...headerVisibility, [path]: visible };
      mutation.mutate({
        admin: adminVisibility,
        operator: operatorVisibility,
        header: nextHeader,
        adminLabels,
        operatorLabels,
        headerLabels,
      });
    },
    [
      orgId,
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      mutation,
    ]
  );

  const setAdminLabel = useCallback(
    (path: string, label: string) => {
      if (!orgId) return;
      const nextAdminLabels = { ...adminLabels };
      if (label.trim()) {
        nextAdminLabels[path] = label.trim();
      } else {
        delete nextAdminLabels[path];
      }
      mutation.mutate({
        admin: adminVisibility,
        operator: operatorVisibility,
        header: headerVisibility,
        adminLabels: nextAdminLabels,
        operatorLabels,
        headerLabels,
      });
    },
    [
      orgId,
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      mutation,
    ]
  );

  const setOperatorLabel = useCallback(
    (path: string, label: string) => {
      if (!orgId) return;
      const nextOperatorLabels = { ...operatorLabels };
      if (label.trim()) {
        nextOperatorLabels[path] = label.trim();
      } else {
        delete nextOperatorLabels[path];
      }
      mutation.mutate({
        admin: adminVisibility,
        operator: operatorVisibility,
        header: headerVisibility,
        adminLabels,
        operatorLabels: nextOperatorLabels,
        headerLabels,
      });
    },
    [
      orgId,
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      mutation,
    ]
  );

  const setHeaderLabel = useCallback(
    (path: string, label: string) => {
      if (!orgId) return;
      const nextHeaderLabels = { ...headerLabels };
      if (label.trim()) {
        nextHeaderLabels[path] = label.trim();
      } else {
        delete nextHeaderLabels[path];
      }
      mutation.mutate({
        admin: adminVisibility,
        operator: operatorVisibility,
        header: headerVisibility,
        adminLabels,
        operatorLabels,
        headerLabels: nextHeaderLabels,
      });
    },
    [
      orgId,
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      mutation,
    ]
  );

  const resetAdminToDefaults = useCallback(() => {
    if (!orgId) return;
    mutation.mutate({
      admin: {},
      operator: operatorVisibility,
      header: headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
    });
  }, [orgId, operatorVisibility, headerVisibility, adminLabels, operatorLabels, headerLabels, mutation]);

  const resetOperatorToDefaults = useCallback(() => {
    if (!orgId) return;
    mutation.mutate({
      admin: adminVisibility,
      operator: {},
      header: headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
    });
  }, [orgId, adminVisibility, headerVisibility, adminLabels, operatorLabels, headerLabels, mutation]);

  const resetHeaderToDefaults = useCallback(() => {
    if (!orgId) return;
    mutation.mutate({
      admin: adminVisibility,
      operator: operatorVisibility,
      header: {},
      adminLabels,
      operatorLabels,
      headerLabels,
    });
  }, [orgId, adminVisibility, operatorVisibility, adminLabels, operatorLabels, headerLabels, mutation]);

  const resetAdminLabels = useCallback(() => {
    if (!orgId) return;
    mutation.mutate({
      admin: adminVisibility,
      operator: operatorVisibility,
      header: headerVisibility,
      adminLabels: {},
      operatorLabels,
      headerLabels,
    });
  }, [orgId, adminVisibility, operatorVisibility, headerVisibility, operatorLabels, headerLabels, mutation]);

  const resetOperatorLabels = useCallback(() => {
    if (!orgId) return;
    mutation.mutate({
      admin: adminVisibility,
      operator: operatorVisibility,
      header: headerVisibility,
      adminLabels,
      operatorLabels: {},
      headerLabels,
    });
  }, [orgId, adminVisibility, operatorVisibility, headerVisibility, adminLabels, headerLabels, mutation]);

  const resetHeaderLabels = useCallback(() => {
    if (!orgId) return;
    mutation.mutate({
      admin: adminVisibility,
      operator: operatorVisibility,
      header: headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels: {},
    });
  }, [orgId, adminVisibility, operatorVisibility, headerVisibility, adminLabels, operatorLabels, mutation]);

  const getAdminLabel = useCallback(
    (path: string, defaultLabel: string) => adminLabels[path]?.trim() || defaultLabel,
    [adminLabels]
  );

  const getOperatorLabel = useCallback(
    (path: string, defaultLabel: string) => operatorLabels[path]?.trim() || defaultLabel,
    [operatorLabels]
  );

  const getHeaderLabel = useCallback(
    (path: string, defaultLabel: string) => headerLabels[path]?.trim() || defaultLabel,
    [headerLabels]
  );

  const getHeaderLogo = useCallback(() => {
    const v = headerLabels[LOGO_KEY];
    return v && v.startsWith("data:") ? v : null;
  }, [headerLabels]);

  useEffect(() => {
    if (!enabled || !data) return;
    const appName = headerLabels[APP_NAME_KEY]?.trim() || "XPOS";
    const logo = headerLabels[LOGO_KEY];
    const logoDataUrl = logo && logo.startsWith("data:") ? logo : null;
    setStoredBranding({ appName, logoDataUrl });
  }, [enabled, data, headerLabels]);

  const setHeaderLogo = useCallback(
    (dataUrl: string | null) => {
      if (!orgId) return;
      const nextHeaderLabels = { ...headerLabels };
      if (dataUrl && dataUrl.startsWith("data:")) {
        nextHeaderLabels[LOGO_KEY] = dataUrl;
      } else {
        delete nextHeaderLabels[LOGO_KEY];
      }
      mutation.mutate({
        admin: adminVisibility,
        operator: operatorVisibility,
        header: headerVisibility,
        adminLabels,
        operatorLabels,
        headerLabels: nextHeaderLabels,
      });
    },
    [
      orgId,
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      mutation,
    ]
  );

  const THEME_KEY = "__darkTheme";

  const darkTheme = headerLabels[THEME_KEY] || localStorage.getItem("xpos_dark_theme") || "ocean";

  useEffect(() => {
    if (document.documentElement.classList.contains("dark") && darkTheme && darkTheme !== "ocean") {
      document.documentElement.dataset.theme = darkTheme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [darkTheme]);

  const setDarkTheme = useCallback(
    (theme: string) => {
      localStorage.setItem("xpos_dark_theme", theme);
      if (document.documentElement.classList.contains("dark") && theme && theme !== "ocean") {
        document.documentElement.dataset.theme = theme;
      } else {
        delete document.documentElement.dataset.theme;
      }
      if (!orgId) return;
      const nextHeaderLabels = { ...headerLabels, [THEME_KEY]: theme };
      mutation.mutate({
        admin: adminVisibility,
        operator: operatorVisibility,
        header: headerVisibility,
        adminLabels,
        operatorLabels,
        headerLabels: nextHeaderLabels,
      });
    },
    [
      orgId,
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      mutation,
    ]
  );

  const value = useMemo(
    () => ({
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      setAdminVisible,
      setOperatorVisible,
      setHeaderVisible,
      setAdminLabel,
      setOperatorLabel,
      setHeaderLabel,
      resetAdminToDefaults,
      resetOperatorToDefaults,
      resetHeaderToDefaults,
      resetAdminLabels,
      resetOperatorLabels,
      resetHeaderLabels,
      getAdminLabel,
      getOperatorLabel,
      getHeaderLabel,
      getHeaderLogo,
      setHeaderLogo,
      darkTheme,
      setDarkTheme,
      isLoading: enabled && isLoading,
      isSaving: mutation.isPending,
      needsOrgSelection: !orgId,
    }),
    [
      adminVisibility,
      operatorVisibility,
      headerVisibility,
      adminLabels,
      operatorLabels,
      headerLabels,
      setAdminVisible,
      setOperatorVisible,
      setHeaderVisible,
      setAdminLabel,
      setOperatorLabel,
      setHeaderLabel,
      resetAdminToDefaults,
      resetOperatorToDefaults,
      resetHeaderToDefaults,
      resetAdminLabels,
      resetOperatorLabels,
      resetHeaderLabels,
      getAdminLabel,
      getOperatorLabel,
      getHeaderLabel,
      getHeaderLogo,
      setHeaderLogo,
      darkTheme,
      setDarkTheme,
      enabled,
      isLoading,
      mutation.isPending,
      orgId,
    ]
  );

  return (
    <NavVisibilityContext.Provider value={value}>{children}</NavVisibilityContext.Provider>
  );
}
