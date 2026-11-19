import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "@/store";
import { setupCrossTabQuerySync } from "@/sync/setupCrossTabQuerySync";
import { getPersistOptions } from "@/sync/queryPersister";
import { setupGlobalDatePicker } from "@/utils/setupGlobalDatePicker";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      placeholderData: keepPreviousData,
    },
    mutations: { retry: 0 },
  },
});

setupCrossTabQuerySync(queryClient, () => {
  const { orgId, branchId } = store.getState().orgContext;
  return { orgId, branchId };
});

setupGlobalDatePicker();

const persistOptions = getPersistOptions();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <BrowserRouter>
          <ThemeProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ThemeProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    </Provider>
  </StrictMode>
);
