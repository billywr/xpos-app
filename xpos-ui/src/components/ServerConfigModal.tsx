import { useState, useEffect } from "react";
import { Globe, Wifi, CheckCircle2, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  getActiveServerConfig,
  setActiveServerConfig,
  resetServerConfig,
  DEFAULT_PROD_CONFIG,
  DEFAULT_DEV_CONFIG,
  type ActiveServerConfig,
} from "@/utils/env";
import { clearStoredAuth } from "@/utils/authStorage";
import { cn } from "@/utils/cn";

export interface ServerConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ServerConfigModal({ open, onClose, onSaved }: ServerConfigModalProps) {
  const [config, setConfig] = useState<ActiveServerConfig>(getActiveServerConfig());
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setConfig(getActiveServerConfig());
      setIsSaved(false);
    }
  }, [open]);

  const isProdActive =
    config.apiBaseUrl === DEFAULT_PROD_CONFIG.API_BASE_URL &&
    config.keycloakUrl === DEFAULT_PROD_CONFIG.KEYCLOAK_URL;

  const isDevActive =
    config.apiBaseUrl === DEFAULT_DEV_CONFIG.API_BASE_URL &&
    config.keycloakUrl === DEFAULT_DEV_CONFIG.KEYCLOAK_URL;

  const applyPreset = (preset: typeof DEFAULT_PROD_CONFIG | typeof DEFAULT_DEV_CONFIG) => {
    setConfig({
      apiBaseUrl: preset.API_BASE_URL,
      keycloakUrl: preset.KEYCLOAK_URL,
      realm: preset.KEYCLOAK_REALM,
      clientId: preset.KEYCLOAK_CLIENT_ID,
    });
  };

  const handleSave = () => {
    setActiveServerConfig(config);
    // Clear any previous session so user signs into the new server cleanly
    clearStoredAuth();
    setIsSaved(true);
    setTimeout(() => {
      onClose();
      if (onSaved) {
        onSaved();
      } else {
        window.location.reload();
      }
    }, 400);
  };

  const handleReset = () => {
    resetServerConfig();
    clearStoredAuth();
    setConfig(getActiveServerConfig());
    setIsSaved(true);
    setTimeout(() => {
      onClose();
      window.location.reload();
    }, 400);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Server & IAM Configuration"
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Switch between cloud production and local dev environments, or enter custom endpoints.
        </p>

        {/* Environment Presets */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Environment Presets
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* Production */}
            <button
              type="button"
              onClick={() => applyPreset(DEFAULT_PROD_CONFIG)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                isProdActive
                  ? "border-emerald-500 bg-emerald-50/70 shadow-sm dark:border-emerald-500/80 dark:bg-emerald-950/30"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750"
              )}
            >
              <Globe
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  isProdActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-xs font-bold",
                    isProdActive ? "text-emerald-900 dark:text-emerald-200" : "text-slate-800 dark:text-white"
                  )}>
                    Production (Cloud)
                  </span>
                  {isProdActive && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  62.169.22.51
                </p>
              </div>
            </button>

            {/* Local Dev */}
            <button
              type="button"
              onClick={() => applyPreset(DEFAULT_DEV_CONFIG)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                isDevActive
                  ? "border-primary-500 bg-primary-50/70 shadow-sm dark:border-primary-500/80 dark:bg-primary-950/30"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750"
              )}
            >
              <Wifi
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  isDevActive ? "text-primary-600 dark:text-primary-400" : "text-slate-400"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-xs font-bold",
                    isDevActive ? "text-primary-900 dark:text-primary-200" : "text-slate-800 dark:text-white"
                  )}>
                    Local Dev (Localhost)
                  </span>
                  {isDevActive && <CheckCircle2 className="h-4 w-4 text-primary-600 dark:text-primary-400" />}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  localhost:9003
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Endpoint Input Fields */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-850">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Backend API URL
            </label>
            <input
              type="text"
              value={config.apiBaseUrl}
              onChange={(e) => setConfig((prev) => ({ ...prev, apiBaseUrl: e.target.value }))}
              placeholder="https://62.169.22.51:9005"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Keycloak IAM URL
            </label>
            <input
              type="text"
              value={config.keycloakUrl}
              onChange={(e) => setConfig((prev) => ({ ...prev, keycloakUrl: e.target.value }))}
              placeholder="https://62.169.22.51:8443"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Keycloak Realm
              </label>
              <input
                type="text"
                value={config.realm}
                onChange={(e) => setConfig((prev) => ({ ...prev, realm: e.target.value }))}
                placeholder="xpos"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Keycloak Client ID
              </label>
              <input
                type="text"
                value={config.clientId}
                onChange={(e) => setConfig((prev) => ({ ...prev, clientId: e.target.value }))}
                placeholder="xpos-client-api"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-primary-500 transition shrink-0"
            >
              {isSaved ? "Saved!" : "Save & Apply"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to default</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 shrink-0"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
