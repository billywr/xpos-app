import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId } from "@/store/selectors/orgContextSelectors";
import { fetchBranches } from "@/api/branches";
import {
  createMpesaBranchConfig,
  createMpesaOrgConfig,
  deactivateMpesaConfig,
  fetchMpesaConfigs,
  fetchMpesaOperatorSettingsAdmin,
  updateMpesaConfig,
  updateMpesaOperatorSettings,
  verifyMpesaConfig,
  type MpesaConfig,
  type MpesaEnvironment,
} from "@/api/mpesa";
import { SearchableSelect } from "@/components/SearchableSelect";
import { getApiErrorMessage, getApiErrorRequestId, isApiFetchError } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Smartphone } from "lucide-react";

const ENV_OPTIONS: { value: MpesaEnvironment; label: string }[] = [
  { value: "SANDBOX", label: "Sandbox" },
  { value: "PRODUCTION", label: "Production" },
];

/** Safaricom shared sandbox STK shortcode (Daraja portal often shows N/A). */
const SANDBOX_SHORTCODE = "174379";

const MPESA_CALLBACK_PATH = "/api/v1/integrations/mpesa/stk/callback";

function validateCallbackBaseUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "Enter a valid HTTPS URL (e.g. https://abc.ngrok-free.app)";
  }
  if (url.protocol !== "https:") {
    return "Safaricom requires HTTPS for the M-PESA callback URL";
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  ) {
    return "Use a public HTTPS tunnel (ngrok), not localhost";
  }
  if (trimmed.includes(MPESA_CALLBACK_PATH)) {
    return undefined;
  }
  return undefined;
}

function ConfigForm({
  initial,
  branchId,
  branchName,
  onSaved,
  onCancel,
}: {
  initial?: MpesaConfig;
  branchId?: string | null;
  branchName?: string | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const [environment, setEnvironment] = useState<MpesaEnvironment>(
    initial?.environment ?? "SANDBOX"
  );
  const [consumerKey, setConsumerKey] = useState(initial?.consumerKey ?? "");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [passkey, setPasskey] = useState("");
  const [shortcode, setShortcode] = useState(
    initial?.shortcode ?? SANDBOX_SHORTCODE
  );
  const [tillNumber, setTillNumber] = useState(initial?.tillNumber ?? "");
  const [stkAutoComplete, setStkAutoComplete] = useState(
    initial?.stkAutoComplete ?? false
  );
  const [callbackBaseUrl, setCallbackBaseUrl] = useState(
    initial?.callbackBaseUrl ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!consumerKey.trim()) {
      next.consumerKey = "Consumer key is required";
    }
    if (!initial && !consumerSecret.trim()) {
      next.consumerSecret = "Consumer secret is required";
    }
    if (initial && !consumerSecret.trim()) {
      next.consumerSecret =
        "Re-enter consumer secret when saving (blank keeps the old value, which may be wrong)";
    }
    if (!shortcode.trim()) {
      next.shortcode = "Business shortcode / paybill is required";
    }
    const callbackError = validateCallbackBaseUrl(callbackBaseUrl);
    if (callbackError) {
      next.callbackBaseUrl = callbackError;
    }
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setError("Fix the highlighted fields below.");
      return false;
    }
    setError(null);
    setFieldErrors({});
    return true;
  };

  const isMpesaFormValid = useMemo(() => {
    if (!consumerKey.trim()) return false;
    if (!consumerSecret.trim()) return false;
    if (!shortcode.trim()) return false;
    if (validateCallbackBaseUrl(callbackBaseUrl)) return false;
    return true;
  }, [consumerKey, consumerSecret, shortcode, callbackBaseUrl]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token || !orgId) {
        throw new Error("Missing org context");
      }
      if (initial) {
        return updateMpesaConfig(token, orgId, initial.id, {
          environment,
          consumerKey: consumerKey.trim() || undefined,
          consumerSecret: consumerSecret.trim() || undefined,
          passkey: passkey.trim() || undefined,
          shortcode: shortcode.trim() || undefined,
          tillNumber: tillNumber.trim() || null,
          stkAutoComplete,
          callbackBaseUrl: callbackBaseUrl.trim() || null,
        });
      }
      const body = {
        environment,
        consumerKey: consumerKey.trim(),
        consumerSecret: consumerSecret.trim(),
        passkey: passkey.trim() || undefined,
        shortcode: shortcode.trim(),
        tillNumber: tillNumber.trim() || null,
        stkAutoComplete,
        callbackBaseUrl: callbackBaseUrl.trim() || null,
      };
      if (branchId) {
        return createMpesaBranchConfig(token, orgId, branchId, body);
      }
      return createMpesaOrgConfig(token, orgId, body);
    },
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
      if (isApiFetchError(err) && err.data.details?.length) {
        const next: Record<string, string> = {};
        for (const d of err.data.details) {
          const key = d.field?.replace(/^(\w+\.)?/, "") ?? "form";
          next[key] = d.message;
        }
        setFieldErrors(next);
      }
    },
  });

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white";
  const fieldErrorClass = "border-red-500 focus:border-red-500 focus:ring-red-500";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
      {branchName && (
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Branch override: {branchName}
        </p>
      )}
      {!initial && !branchId && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Org-default Daraja credentials used when no branch override exists.
        </p>
      )}
      {environment === "SANDBOX" && !initial && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-100">
          <p className="font-medium">Sandbox note</p>
          <p className="mt-1 text-primary-800 dark:text-primary-200">
            Daraja often shows Passkey and Short Code as N/A for sandbox apps. Use your
            Consumer Key and Secret from the portal. Shortcode is typically{" "}
            <span className="font-mono">{SANDBOX_SHORTCODE}</span>. Leave passkey blank to
            use the sandbox default automatically. M-PESA requires a{" "}
            <strong>public HTTPS callback URL</strong> — set{" "}
            <span className="font-mono">XPOS_MPESA_CALLBACK_URL</span> on the server or
            Callback base URL below (e.g. ngrok). Test M-PESA with phone{" "}
            <span className="font-mono">254708374149</span> and PIN{" "}
            <span className="font-mono">174379</span>.
          </p>
        </div>
      )}
      <SearchableSelect
        options={ENV_OPTIONS}
        value={environment}
        onChange={(v) => setEnvironment(v as MpesaEnvironment)}
        placeholder="Environment"
        matchOptionValue
        aria-label="Daraja environment"
        controlClassName={inputClass}
      />
      <input
        type="text"
        required
        value={consumerKey}
        onChange={(e) => setConsumerKey(e.target.value)}
        placeholder="Consumer key"
        className={`${inputClass}${fieldErrors.consumerKey ? ` ${fieldErrorClass}` : ""}`}
        aria-label="Consumer key"
        aria-invalid={Boolean(fieldErrors.consumerKey)}
      />
      {fieldErrors.consumerKey && (
        <p className="text-sm text-red-500">{fieldErrors.consumerKey}</p>
      )}
      <input
        type="password"
        required={!initial}
        value={consumerSecret}
        onChange={(e) => setConsumerSecret(e.target.value)}
        placeholder={
          initial
            ? "Consumer secret (required on save — paste from Daraja portal)"
            : "Consumer secret"
        }
        className={`${inputClass}${fieldErrors.consumerSecret ? ` ${fieldErrorClass}` : ""}`}
        aria-label="Consumer secret"
        aria-invalid={Boolean(fieldErrors.consumerSecret)}
      />
      {fieldErrors.consumerSecret && (
        <p className="text-sm text-red-500">{fieldErrors.consumerSecret}</p>
      )}
      <input
        type="password"
        value={passkey}
        onChange={(e) => setPasskey(e.target.value)}
        placeholder={
          initial
            ? `Passkey (${initial.passkeyMasked} — leave blank to keep)`
            : "Lipa Na M-PESA passkey (optional in sandbox)"
        }
        className={`${inputClass}${fieldErrors.passkey ? ` ${fieldErrorClass}` : ""}`}
        aria-label="Passkey"
        aria-invalid={Boolean(fieldErrors.passkey)}
      />
      {fieldErrors.passkey && (
        <p className="text-sm text-red-500">{fieldErrors.passkey}</p>
      )}
      <input
        type="text"
        required
        value={shortcode}
        onChange={(e) => setShortcode(e.target.value)}
        placeholder="Business shortcode / paybill"
        className={`${inputClass}${fieldErrors.shortcode ? ` ${fieldErrorClass}` : ""}`}
        aria-label="Shortcode"
        aria-invalid={Boolean(fieldErrors.shortcode)}
      />
      {fieldErrors.shortcode && (
        <p className="text-sm text-red-500">{fieldErrors.shortcode}</p>
      )}
      <input
        type="text"
        value={tillNumber}
        onChange={(e) => setTillNumber(e.target.value)}
        placeholder="Till number (optional, for buy goods)"
        className={inputClass}
        aria-label="Till number"
      />
      <input
        type="url"
        value={callbackBaseUrl}
        onChange={(e) => setCallbackBaseUrl(e.target.value)}
        placeholder="https://abc.ngrok-free.app (public HTTPS tunnel to backend)"
        className={`${inputClass}${fieldErrors.callbackBaseUrl ? ` ${fieldErrorClass}` : ""}`}
        aria-label="Callback base URL"
        aria-invalid={Boolean(fieldErrors.callbackBaseUrl)}
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Safaricom POSTs payment results here. We append{" "}
        <span className="font-mono">{MPESA_CALLBACK_PATH}</span>. Leave blank only if{" "}
        <span className="font-mono">XPOS_MPESA_CALLBACK_URL</span> is set on the server.
      </p>
      {fieldErrors.callbackBaseUrl && (
        <p className="text-sm text-red-500">{fieldErrors.callbackBaseUrl}</p>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={stkAutoComplete}
          onChange={(e) => setStkAutoComplete(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
        />
        Auto-complete sale when M-PESA payment covers the total
      </label>
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saveMutation.isPending || !isMpesaFormValid}
          onClick={() => {
            if (validate()) {
              saveMutation.mutate();
            }
          }}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveMutation.isPending ? "Saving…" : initial ? "Update" : "Save"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function MpesaSettingsSection() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [editConfig, setEditConfig] = useState<MpesaConfig | null>(null);
  const [branchOverrideId, setBranchOverrideId] = useState("");

  const configsQuery = useQuery({
    queryKey: ["mpesa-configs", orgId],
    queryFn: () => fetchMpesaConfigs(token, orgId!),
    enabled: Boolean(token && orgId),
  });

  const operatorSettingsQuery = useQuery({
    queryKey: ["mpesa-operator-settings", orgId],
    queryFn: () => fetchMpesaOperatorSettingsAdmin(token, orgId!),
    enabled: Boolean(token && orgId),
  });

  const operatorSettingsMutation = useMutation({
    mutationFn: (stkOperatorEnabled: boolean) => {
      if (!token || !orgId) {
        throw new Error("Missing org");
      }
      return updateMpesaOperatorSettings(token, orgId, stkOperatorEnabled);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["mpesa-operator-settings", orgId], data);
      toast.success(
        data.stkOperatorEnabled
          ? "Pay by M-PESA is now visible at checkout."
          : "Pay by M-PESA is hidden at checkout."
      );
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const branchesQuery = useQuery({
    queryKey: ["branches", orgId, "mpesa-settings"],
    queryFn: () => fetchBranches(token, orgId!, { size: 200 }),
    enabled: Boolean(token && orgId),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (configId: string) => {
      if (!token || !orgId) {
        throw new Error("Missing org");
      }
      await deactivateMpesaConfig(token, orgId, configId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mpesa-configs", orgId] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (configId: string) => {
      if (!token || !orgId) {
        throw new Error("Missing org");
      }
      return verifyMpesaConfig(token, orgId, configId);
    },
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const configs = configsQuery.data ?? [];
  const orgDefault = configs.find((c) => !c.branchId && c.status === "ACTIVE");
  const branchConfigs = configs.filter((c) => c.branchId);
  const branchOptions = (branchesQuery.data?.content ?? []).map((b) => ({
    value: b.id,
    label: b.name,
  }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["mpesa-configs", orgId] });
    setShowOrgForm(false);
    setEditConfig(null);
    setBranchOverrideId("");
  };

  if (!orgId) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-white">
        <Smartphone className="h-5 w-5" />
        M-PESA
      </h2>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Configure Safaricom Daraja credentials for Lipa Na M-PESA at checkout.
        Set org-default credentials here; add branch overrides when a branch uses different
        paybill/till numbers. Operators use the <strong>branch override</strong> when one exists
        for their branch — otherwise org default. Environment must be <strong>Sandbox</strong> for
        Daraja sandbox keys.
      </p>
      <div className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800/50">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={operatorSettingsQuery.data?.stkOperatorEnabled ?? false}
              disabled={
                operatorSettingsQuery.isLoading || operatorSettingsMutation.isPending
              }
              onChange={(e) => operatorSettingsMutation.mutate(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800 dark:text-white">
                Show Pay by M-PESA at checkout
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Off by default. When enabled, operators see the M-PESA tab in Manage
                payments. Daraja credentials below are still required for M-PESA to work.
              </span>
            </span>
          </label>
        </div>
        {configsQuery.isLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        )}
        {configsQuery.isError && (
          <p className="text-sm text-red-500" role="alert">
            {getApiErrorMessage(configsQuery.error)}
            {getApiErrorRequestId(configsQuery.error) && (
              <span className="mt-1 block text-xs">
                Request ID: {getApiErrorRequestId(configsQuery.error)}
              </span>
            )}
          </p>
        )}

        {orgDefault && !editConfig && (
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800 dark:text-white">Org default</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {orgDefault.environment} · Shortcode {orgDefault.shortcode}
                  {orgDefault.stkAutoComplete ? " · Auto-complete on" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate(orgDefault.id)}
                  className="text-sm text-slate-600 hover:underline disabled:opacity-50 dark:text-slate-300"
                >
                  Verify Daraja
                </button>
                <button
                  type="button"
                  onClick={() => setEditConfig(orgDefault)}
                  className="text-sm text-primary-600 hover:underline dark:text-primary-400"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deactivateMutation.mutate(orgDefault.id)}
                  className="text-sm text-red-600 hover:underline dark:text-red-400"
                >
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        )}

        {!orgDefault && !showOrgForm && !editConfig && (
          <button
            type="button"
            onClick={() => setShowOrgForm(true)}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            Add org-default M-PESA config
          </button>
        )}

        {(showOrgForm || (editConfig && !editConfig.branchId)) && (
          <ConfigForm
            initial={editConfig && !editConfig.branchId ? editConfig : undefined}
            onSaved={refresh}
            onCancel={() => {
              setShowOrgForm(false);
              setEditConfig(null);
            }}
          />
        )}

        {branchConfigs.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Branch overrides
            </h3>
            <ul className="space-y-2">
              {branchConfigs.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-600"
                >
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">
                      {c.branchName ?? c.branchId}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {c.status} · {c.environment} · {c.shortcode}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "ACTIVE" && (
                      <button
                        type="button"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate(c.id)}
                        className="text-sm text-slate-600 hover:underline disabled:opacity-50 dark:text-slate-300"
                      >
                        Verify Daraja
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditConfig(c)}
                      className="text-sm text-primary-600 hover:underline dark:text-primary-400"
                    >
                      Edit
                    </button>
                    {c.status === "ACTIVE" && (
                      <button
                        type="button"
                        onClick={() => deactivateMutation.mutate(c.id)}
                        className="text-sm text-red-600 hover:underline dark:text-red-400"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {editConfig?.branchId && (
          <ConfigForm
            initial={editConfig}
            branchId={editConfig.branchId}
            branchName={editConfig.branchName}
            onSaved={refresh}
            onCancel={() => setEditConfig(null)}
          />
        )}

        {!branchOverrideId && orgDefault && !editConfig && (
          <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
            <SearchableSelect
              options={branchOptions}
              value=""
              onChange={(id) => setBranchOverrideId(id)}
              placeholder="Add branch override…"
              aria-label="Branch for M-PESA override"
              controlClassName="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700"
            />
          </div>
        )}

        {branchOverrideId && (
          <ConfigForm
            branchId={branchOverrideId}
            branchName={
              branchOptions.find((b) => b.value === branchOverrideId)?.label ?? null
            }
            onSaved={refresh}
            onCancel={() => setBranchOverrideId("")}
          />
        )}
      </div>
    </section>
  );
}
