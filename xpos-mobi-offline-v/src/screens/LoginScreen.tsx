import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  type TextInput as RNTextInput,
} from "react-native";
import { useToast } from "@/context/ToastContext";
import { Store, Settings, Lock, User, Server, Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/utils/storage";
import { setDefaultApiBaseUrl } from "@/api/client";
import { DEFAULT_CONFIG, LOCALHOST_CONFIG } from "@/constants/config";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { AnimatedModalBackdrop } from "@/components/ui/AnimatedModalBackdrop";
import { ScalePressable } from "@/components/ui/ScalePressable";
import { haptics } from "@/utils/haptics";

export const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const { login, isLoading } = useAuth();
  const toast = useToast();
  const passwordRef = useRef<RNTextInput>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Server settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(DEFAULT_CONFIG.API_BASE_URL);
  const [keycloakUrl, setKeycloakUrl] = useState<string>(DEFAULT_CONFIG.KEYCLOAK_URL);
  const [realm, setRealm] = useState<string>(DEFAULT_CONFIG.KEYCLOAK_REALM);
  const [clientId, setClientId] = useState<string>(DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID);

  // Reload settings every time LoginScreen is focused (e.g. returning from server-config)
  useFocusEffect(
    useCallback(() => {
      async function loadSettings() {
        const storedApi = await storage.getApiBaseUrl();
        if (storedApi) setApiBaseUrl(storedApi);
        const storedKc = await storage.getKeycloakUrl();
        if (storedKc) setKeycloakUrl(storedKc);
        const storedRealm = await storage.getRealm();
        if (storedRealm) setRealm(storedRealm);
        const storedClientId = await storage.getClientId();
        if (storedClientId) setClientId(storedClientId);
      }
      void loadSettings();
    }, [])
  );

  const handleLogin = async () => {
    try {
      await login({ username: username.trim() || "Store Manager" });
      haptics.success();
      router.replace("/(app)/(tabs)/stock");
    } catch (err: any) {
      haptics.error();
      setErrorMsg("Offline sign in failed.");
    }
  };

  const handleSaveSettings = async () => {
    await storage.setApiBaseUrl(apiBaseUrl);
    await storage.setKeycloakUrl(keycloakUrl);
    await storage.setRealm(realm);
    await storage.setClientId(clientId);
    setDefaultApiBaseUrl(apiBaseUrl);
    setSettingsOpen(false);
    haptics.success();
    toast.success("Server configuration updated.");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Right Corner Settings Button */}
      <ScalePressable
        onPress={() => setSettingsOpen(true)}
        activeScale={0.92}
        style={[
          styles.cornerSettingsBtn,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          },
        ]}
        accessibilityLabel="Server Settings"
      >
        <Settings size={15} color={colors.textMuted} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text }}>
          {keycloakUrl.includes("62.169.22.51") ? "Production" : "Local Dev"}
        </Text>
      </ScalePressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentWrapper}>
            {/* Logo & Title */}
            <View style={styles.header}>
              <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
                <Store size={36} color="#ffffff" />
              </View>
              <Text style={[styles.appName, { color: colors.text }]}>XPOS Mobile</Text>
              <Text style={[styles.appSubtitle, { color: colors.textMuted }]}>
                Stock Control · Catalog · Debts & Expenses
              </Text>
            </View>

            {/* Login Form */}
            <Card style={styles.card}>
              {errorMsg ? (
                <View
                  style={[
                    styles.errorBox,
                    { backgroundColor: colors.dangerLight, borderColor: colors.danger },
                  ]}
                >
                  <Text style={[styles.errorText, { color: colors.danger }]}>
                    {errorMsg}
                  </Text>
                  {Platform.OS === "web" &&
                  (errorMsg.includes("Keycloak") ||
                    errorMsg.includes("SSL") ||
                    errorMsg.includes("certificate")) ? (
                    <TouchableOpacity
                      onPress={() => {
                        if (typeof window !== "undefined") {
                          window.open(`${keycloakUrl}/realms/${realm}`, "_blank");
                        }
                      }}
                      style={styles.certHelpBtn}
                    >
                      <Text style={[styles.certHelpBtnText, { color: colors.danger }]}>
                        Tap here to trust SSL certificate in browser ↗
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <Input
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. operator"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                leftIcon={<User size={18} color={colors.textSubtle} />}
              />

              <Input
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                leftIcon={<Lock size={18} color={colors.textSubtle} />}
                rightIcon={
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={colors.textSubtle} />
                    ) : (
                      <Eye size={18} color={colors.textSubtle} />
                    )}
                  </TouchableOpacity>
                }
              />

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                style={{ marginTop: 8 }}
              />
            </Card>

            {/* Server status footnote */}
            <TouchableOpacity
              onPress={() => setSettingsOpen(true)}
              style={styles.serverInfo}
              activeOpacity={0.7}
            >
              <Server size={14} color={colors.textSubtle} />
              <Text style={[styles.serverText, { color: colors.textSubtle }]}>
                API: {apiBaseUrl}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Settings Modal */}
      <Modal
        visible={settingsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSettingsOpen(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setSettingsOpen(false)}
        >
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Server Configuration
              </Text>
              <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
                Switch presets or manually configure Spring Boot API and Keycloak IAM endpoints.
              </Text>

              {/* Quick Preset Buttons */}
              <View style={styles.presetContainer}>
                <Text style={[styles.presetLabel, { color: colors.textSubtle }]}>
                  QUICK PRESETS
                </Text>
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      {
                        backgroundColor:
                          apiBaseUrl === DEFAULT_CONFIG.API_BASE_URL
                            ? colors.primaryLight
                            : colors.surfaceRaised,
                        borderColor:
                          apiBaseUrl === DEFAULT_CONFIG.API_BASE_URL
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setApiBaseUrl(DEFAULT_CONFIG.API_BASE_URL);
                      setKeycloakUrl(DEFAULT_CONFIG.KEYCLOAK_URL);
                      setRealm(DEFAULT_CONFIG.KEYCLOAK_REALM);
                      setClientId(DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID);
                      haptics.light();
                    }}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        {
                          color:
                            apiBaseUrl === DEFAULT_CONFIG.API_BASE_URL
                              ? colors.primary
                              : colors.text,
                        },
                      ]}
                    >
                      Production (62.169.22.51)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      {
                        backgroundColor:
                          apiBaseUrl === LOCALHOST_CONFIG.API_BASE_URL
                            ? colors.primaryLight
                            : colors.surfaceRaised,
                        borderColor:
                          apiBaseUrl === LOCALHOST_CONFIG.API_BASE_URL
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setApiBaseUrl(LOCALHOST_CONFIG.API_BASE_URL);
                      setKeycloakUrl(LOCALHOST_CONFIG.KEYCLOAK_URL);
                      setRealm(LOCALHOST_CONFIG.KEYCLOAK_REALM);
                      setClientId(LOCALHOST_CONFIG.KEYCLOAK_CLIENT_ID);
                      haptics.light();
                    }}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        {
                          color:
                            apiBaseUrl === LOCALHOST_CONFIG.API_BASE_URL
                              ? colors.primary
                              : colors.text,
                        },
                      ]}
                    >
                      Local Dev (Localhost)
                    </Text>
                  </TouchableOpacity>

                </View>
              </View>

              <Input
                label="XPOS Backend API URL"
                value={apiBaseUrl}
                onChangeText={setApiBaseUrl}
                placeholder="https://62.169.22.51:9005"
                autoCapitalize="none"
              />

              <Input
                label="Keycloak Server URL"
                value={keycloakUrl}
                onChangeText={setKeycloakUrl}
                placeholder="https://62.169.22.51:8443"
                autoCapitalize="none"
              />

              <Input
                label="Keycloak Realm"
                value={realm}
                onChangeText={setRealm}
                placeholder="xpos"
                autoCapitalize="none"
              />

              <Input
                label="Keycloak Client ID"
                value={clientId}
                onChangeText={setClientId}
                placeholder="xpos-client-api"
                autoCapitalize="none"
              />

              <View style={styles.modalBtns}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setSettingsOpen(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Save Settings"
                  onPress={handleSaveSettings}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </AnimatedModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  cornerSettingsBtn: {
    position: "absolute",
    top: Platform.OS === "web" ? 20 : 16,
    right: 20,
    zIndex: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#10b981",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  appName: {
    fontSize: 26,
    fontWeight: "800",
  },
  appSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    padding: 20,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
  },
  serverInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
  },
  serverText: {
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  presetContainer: {
    marginBottom: 14,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  modalBtns: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 8,
  },
  certHelpBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
  },
  certHelpBtnText: {
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
