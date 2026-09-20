import React, { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Server,
  Shield,
  Globe,
  CheckCircle2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Wifi,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { storage, type CustomServer } from "@/utils/storage";
import { setDefaultApiBaseUrl } from "@/api/client";
import { DEFAULT_CONFIG, LOCALHOST_CONFIG } from "@/constants/config";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { haptics } from "@/utils/haptics";

export default function ServerConfigModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { clearContext } = useOrg();

  // Active endpoint fields (the ones currently typed / selected)
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(DEFAULT_CONFIG.API_BASE_URL);
  const [keycloakUrl, setKeycloakUrl] = useState<string>(DEFAULT_CONFIG.KEYCLOAK_URL);
  const [realm, setRealm] = useState<string>(DEFAULT_CONFIG.KEYCLOAK_REALM);
  const [clientId, setClientId] = useState<string>(DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID);
  const [saved, setSaved] = useState(false);

  // Custom servers list
  const [customServers, setCustomServers] = useState<CustomServer[]>([]);

  // Add-custom-server form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newApi, setNewApi] = useState("");
  const [newKc, setNewKc] = useState("");
  const [newRealm, setNewRealm] = useState("xpos");
  const [newClientId, setNewClientId] = useState("xpos-client-api");

  const loadSettings = useCallback(async () => {
    const storedApi = await storage.getApiBaseUrl();
    if (storedApi) setApiBaseUrl(storedApi);
    const storedKc = await storage.getKeycloakUrl();
    if (storedKc) setKeycloakUrl(storedKc);
    const storedRealm = await storage.getRealm();
    if (storedRealm) setRealm(storedRealm);
    const storedClientId = await storage.getClientId();
    if (storedClientId) setClientId(storedClientId);
    const servers = await storage.getCustomServers();
    setCustomServers(servers);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!apiBaseUrl.trim() || !keycloakUrl.trim()) {
      Alert.alert("Missing Fields", "API Base URL and Keycloak URL are required.");
      return;
    }
    await storage.setApiBaseUrl(apiBaseUrl.trim());
    await storage.setKeycloakUrl(keycloakUrl.trim());
    await storage.setRealm(realm.trim() || DEFAULT_CONFIG.KEYCLOAK_REALM);
    await storage.setClientId(clientId.trim() || DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID);
    setDefaultApiBaseUrl(apiBaseUrl.trim());
    // Clear all cached query data so every screen re-fetches from the new server
    queryClient.clear();
    // Clear session and log out so user authenticates fresh against the new environment
    await logout();
    await clearContext();
    haptics.success();
    setSaved(true);
    setTimeout(() => {
      router.replace("/(auth)/login");
    }, 400);
  };

  const applyPreset = (api: string, kc: string, r: string, c: string) => {
    haptics.light();
    setApiBaseUrl(api);
    setKeycloakUrl(kc);
    setRealm(r);
    setClientId(c);
    setSaved(false);
  };

  const handleSaveCustomServer = async () => {
    if (!newName.trim()) {
      Alert.alert("Name Required", "Please enter a name for this server (e.g. Staging).");
      return;
    }
    if (!newApi.trim() || !newKc.trim()) {
      Alert.alert("Missing Fields", "API URL and Keycloak URL are required.");
      return;
    }
    const entry: CustomServer = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: newName.trim(),
      apiBaseUrl: newApi.trim(),
      keycloakUrl: newKc.trim(),
      realm: newRealm.trim() || "xpos",
      clientId: newClientId.trim() || "xpos-client-api",
    };
    const updated = [...customServers, entry];
    await storage.setCustomServers(updated);
    setCustomServers(updated);
    // Also apply it as the active config
    applyPreset(entry.apiBaseUrl, entry.keycloakUrl, entry.realm, entry.clientId);
    // Reset form
    setNewName("");
    setNewApi("");
    setNewKc("");
    setNewRealm("xpos");
    setNewClientId("xpos-client-api");
    setShowAddForm(false);
    haptics.success();
  };

  const handleDeleteCustomServer = (id: string, name: string) => {
    Alert.alert(
      "Remove Server",
      `Remove "${name}" from your saved servers?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            haptics.warning();
            const updated = customServers.filter((s) => s.id !== id);
            await storage.setCustomServers(updated);
            setCustomServers(updated);
          },
        },
      ]
    );
  };

  const isProdActive = apiBaseUrl === DEFAULT_CONFIG.API_BASE_URL;
  const isLocalhostActive = apiBaseUrl === LOCALHOST_CONFIG.API_BASE_URL;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Server &amp; IAM Configuration
        </Text>
        <Text style={[styles.desc, { color: colors.textMuted }]}>
          Choose a preset or enter custom backend API and Keycloak IAM endpoints.
        </Text>

        {/* Built-in Presets */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>
            BUILT-IN ENVIRONMENTS
          </Text>
          <View style={styles.presetRow}>
            {/* Production */}
            <TouchableOpacity
              style={[
                styles.presetBtn,
                {
                  backgroundColor: isProdActive
                    ? colors.primaryLight
                    : colors.surfaceRaised,
                  borderColor: isProdActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() =>
                applyPreset(
                  DEFAULT_CONFIG.API_BASE_URL,
                  DEFAULT_CONFIG.KEYCLOAK_URL,
                  DEFAULT_CONFIG.KEYCLOAK_REALM,
                  DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID
                )
              }
            >
              <Globe
                size={16}
                color={isProdActive ? colors.primary : colors.textSubtle}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.presetName,
                    { color: isProdActive ? colors.primary : colors.text },
                  ]}
                >
                  Production (Cloud)
                </Text>
                <Text style={[styles.presetUrl, { color: colors.textMuted }]}>
                  {DEFAULT_CONFIG.API_BASE_URL}
                </Text>
              </View>
              {isProdActive ? (
                <CheckCircle2 size={16} color={colors.primary} />
              ) : null}
            </TouchableOpacity>

            {/* Localhost */}
            <TouchableOpacity
              style={[
                styles.presetBtn,
                {
                  backgroundColor: isLocalhostActive
                    ? colors.primaryLight
                    : colors.surfaceRaised,
                  borderColor: isLocalhostActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() =>
                applyPreset(
                  LOCALHOST_CONFIG.API_BASE_URL,
                  LOCALHOST_CONFIG.KEYCLOAK_URL,
                  LOCALHOST_CONFIG.KEYCLOAK_REALM,
                  LOCALHOST_CONFIG.KEYCLOAK_CLIENT_ID
                )
              }
            >
              <Wifi
                size={16}
                color={isLocalhostActive ? colors.primary : colors.textSubtle}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.presetName,
                    { color: isLocalhostActive ? colors.primary : colors.text },
                  ]}
                >
                  Local Dev (Localhost)
                </Text>
                <Text style={[styles.presetUrl, { color: colors.textMuted }]}>
                  {LOCALHOST_CONFIG.API_BASE_URL}
                </Text>
              </View>
              {isLocalhostActive ? (
                <CheckCircle2 size={16} color={colors.primary} />
              ) : null}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Custom Saved Servers */}
        {customServers.length > 0 ? (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>
              CUSTOM SERVERS
            </Text>
            <View style={styles.presetRow}>
              {customServers.map((server) => {
                const isActive = apiBaseUrl === server.apiBaseUrl;
                return (
                  <View
                    key={server.id}
                    style={[
                      styles.presetBtn,
                      styles.customPresetBtn,
                      {
                        backgroundColor: isActive
                          ? colors.primaryLight
                          : colors.surfaceRaised,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.customPresetMain}
                      onPress={() =>
                        applyPreset(
                          server.apiBaseUrl,
                          server.keycloakUrl,
                          server.realm,
                          server.clientId
                        )
                      }
                    >
                      <Server
                        size={16}
                        color={isActive ? colors.primary : colors.textSubtle}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.presetName,
                            { color: isActive ? colors.primary : colors.text },
                          ]}
                        >
                          {server.name}
                        </Text>
                        <Text style={[styles.presetUrl, { color: colors.textMuted }]}>
                          {server.apiBaseUrl}
                        </Text>
                      </View>
                      {isActive ? (
                        <CheckCircle2 size={16} color={colors.primary} />
                      ) : null}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteCustomServer(server.id, server.name)}
                      style={[
                        styles.deleteBtn,
                        { borderLeftColor: colors.border },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={15} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {/* Add Custom Server */}
        <Card style={styles.card}>
          <TouchableOpacity
            style={styles.addToggleBtn}
            onPress={() => {
              haptics.light();
              setShowAddForm((v) => !v);
            }}
          >
            <Plus size={16} color={colors.primary} />
            <Text style={[styles.addToggleText, { color: colors.primary }]}>
              Add Custom Server
            </Text>
            {showAddForm ? (
              <ChevronUp size={16} color={colors.primary} />
            ) : (
              <ChevronDown size={16} color={colors.primary} />
            )}
          </TouchableOpacity>

          {showAddForm ? (
            <View style={styles.addForm}>
              <Input
                label="Server Name *"
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Staging, Test VPS"
                autoCapitalize="words"
              />
              <Input
                label="API Base URL *"
                value={newApi}
                onChangeText={setNewApi}
                placeholder="https://your-server.example.com:9005"
                autoCapitalize="none"
                leftIcon={<Server size={18} color={colors.textSubtle} />}
              />
              <Input
                label="Keycloak URL *"
                value={newKc}
                onChangeText={setNewKc}
                placeholder="https://your-server.example.com:8443"
                autoCapitalize="none"
                leftIcon={<Shield size={18} color={colors.textSubtle} />}
              />
              <Input
                label="Realm"
                value={newRealm}
                onChangeText={setNewRealm}
                placeholder="xpos"
                autoCapitalize="none"
              />
              <Input
                label="Client ID"
                value={newClientId}
                onChangeText={setNewClientId}
                placeholder="xpos-client-api"
                autoCapitalize="none"
              />
              <Button
                title="Save & Use This Server"
                onPress={() => { void handleSaveCustomServer(); }}
                disabled={!newName.trim() || !newApi.trim() || !newKc.trim()}
                style={{ marginTop: 4 }}
              />
            </View>
          ) : null}
        </Card>

        {/* Manual endpoint override */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>
            ACTIVE ENDPOINTS
          </Text>
          <Input
            label="XPOS Backend API URL"
            value={apiBaseUrl}
            onChangeText={(v) => { setApiBaseUrl(v); setSaved(false); }}
            placeholder="https://your-server.example.com:9005"
            autoCapitalize="none"
            leftIcon={<Server size={18} color={colors.textSubtle} />}
          />
          <Input
            label="Keycloak Server URL"
            value={keycloakUrl}
            onChangeText={(v) => { setKeycloakUrl(v); setSaved(false); }}
            placeholder="https://your-server.example.com:8443"
            autoCapitalize="none"
            leftIcon={<Shield size={18} color={colors.textSubtle} />}
          />
          <Input
            label="Keycloak Realm"
            value={realm}
            onChangeText={(v) => { setRealm(v); setSaved(false); }}
            placeholder="xpos"
            autoCapitalize="none"
          />
          <Input
            label="Keycloak Client ID"
            value={clientId}
            onChangeText={(v) => { setClientId(v); setSaved(false); }}
            placeholder="xpos-client-api"
            autoCapitalize="none"
          />
        </Card>

        {/* Action buttons */}
        <View style={styles.btnRow}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => router.back()}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button
            title={saved ? "Saved ✓" : "Save & Apply"}
            onPress={() => { void handleSave(); }}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  card: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: "column",
    gap: 8,
  },
  presetBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  presetName: {
    fontSize: 13,
    fontWeight: "600",
  },
  presetUrl: {
    fontSize: 11,
    marginTop: 1,
  },
  customPresetBtn: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  customPresetMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  deleteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  addForm: {
    marginTop: 16,
    gap: 0,
  },
  btnRow: {
    flexDirection: "row",
    marginTop: 8,
  },
});
