import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { Store, Settings, Lock, User, Server, Eye, EyeOff, KeyRound, WifiOff, CheckCircle2 } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/utils/storage";
import { setDefaultApiBaseUrl } from "@/api/client";
import { DEFAULT_CONFIG } from "@/constants/config";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { haptics } from "@/utils/haptics";

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { login, loginWithOfflinePin, isLoading, isAuthenticated, hasOfflinePin, refreshOfflinePinStatus } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<RNTextInput>(null);
  const pinInputRef = useRef<RNTextInput>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(DEFAULT_CONFIG.API_BASE_URL);

  const [isOnline, setIsOnline] = useState(true);
  const [loginMode, setLoginMode] = useState<"password" | "pin">("password");
  const [pin, setPin] = useState("");

  useFocusEffect(
    useCallback(() => {
      void refreshOfflinePinStatus();
      void storage.getApiBaseUrl().then((storedApi) => {
        if (storedApi) setApiBaseUrl(storedApi);
      });
      void NetInfo.fetch().then((net) => {
        const online = Boolean(net.isConnected);
        setIsOnline(online);
        if (!online) {
          setLoginMode("pin");
        }
      });
    }, [refreshOfflinePinStatus])
  );

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(app)/(tabs)/stock");
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setErrorMsg("Please enter both username and password");
      return;
    }
    setErrorMsg("");
    try {
      const storedApi = (await storage.getApiBaseUrl()) ?? DEFAULT_CONFIG.API_BASE_URL;
      const storedKc = (await storage.getKeycloakUrl()) ?? DEFAULT_CONFIG.KEYCLOAK_URL;
      const storedRealm = (await storage.getRealm()) ?? DEFAULT_CONFIG.KEYCLOAK_REALM;
      const storedClientId = (await storage.getClientId()) ?? DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID;

      setDefaultApiBaseUrl(storedApi);
      await login({
        keycloakUrl: storedKc,
        realm: storedRealm,
        clientId: storedClientId,
        username: username.trim(),
        password,
      });
      haptics.success();
      router.replace("/(app)/(tabs)/stock");
    } catch (err: any) {
      haptics.error();
      setErrorMsg(err.message ?? "Login failed. Check server connection.");
    }
  };

  const handlePinChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 4);
    setPin(clean);
    setErrorMsg("");
    if (clean.length === 4) {
      void handlePinSubmit(clean);
    }
  };

  const handlePinSubmit = async (pinValue?: string) => {
    const val = pinValue ?? pin;
    if (val.length !== 4) {
      setErrorMsg("Please enter all 4 digits");
      haptics.error();
      return;
    }
    setErrorMsg("");
    try {
      const ok = await loginWithOfflinePin(val);
      if (ok) {
        haptics.success();
        router.replace("/(app)/(tabs)/stock");
      } else {
        haptics.error();
        setErrorMsg("Incorrect 4-digit PIN. Please try again.");
        setPin("");
      }
    } catch (err: any) {
      haptics.error();
      setErrorMsg(err.message ?? "Offline PIN verification failed.");
      setPin("");
    }
  };

  const openServerConfig = () => {
    haptics.light();
    router.push("/server-config");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Right Corner Settings Button */}
      <TouchableOpacity
        onPress={openServerConfig}
        style={[
          styles.cornerSettingsBtn,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
        accessibilityLabel="Server Settings"
      >
        <Settings size={20} color={colors.textMuted} />
      </TouchableOpacity>

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
              {/* Login Mode Switcher */}
              {(hasOfflinePin || !isOnline) ? (
                <View style={[styles.modeToggleRow, { backgroundColor: colors.surfaceRaised }]}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setLoginMode("password");
                      setErrorMsg("");
                    }}
                    style={[
                      styles.modeToggleBtn,
                      loginMode === "password" && [
                        styles.modeToggleBtnActive,
                        { backgroundColor: colors.surface },
                      ],
                    ]}
                  >
                    <Lock size={14} color={loginMode === "password" ? colors.primary : colors.textSubtle} />
                    <Text
                      style={[
                        styles.modeToggleText,
                        {
                          color: loginMode === "password" ? colors.text : colors.textSubtle,
                          fontWeight: loginMode === "password" ? "700" : "500",
                        },
                      ]}
                    >
                      Password
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setLoginMode("pin");
                      setErrorMsg("");
                      setTimeout(() => pinInputRef.current?.focus(), 150);
                    }}
                    style={[
                      styles.modeToggleBtn,
                      loginMode === "pin" && [
                        styles.modeToggleBtnActive,
                        { backgroundColor: colors.surface },
                      ],
                    ]}
                  >
                    <KeyRound size={14} color={loginMode === "pin" ? colors.primary : colors.textSubtle} />
                    <Text
                      style={[
                        styles.modeToggleText,
                        {
                          color: loginMode === "pin" ? colors.text : colors.textSubtle,
                          fontWeight: loginMode === "pin" ? "700" : "500",
                        },
                      ]}
                    >
                      Offline PIN
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Offline Banner */}
              {!isOnline ? (
                <View
                  style={[
                    styles.offlineBanner,
                    { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#fef3c7" },
                  ]}
                >
                  <WifiOff size={15} color={colors.warning} />
                  <Text style={[styles.offlineBannerText, { color: colors.warning }]}>
                    No internet connection. Use your 4-digit PIN for offline access.
                  </Text>
                </View>
              ) : null}

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
                </View>
              ) : null}

              {loginMode === "password" ? (
                <>
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
                </>
              ) : (
                /* Offline PIN Login View */
                <View style={styles.pinWrapper}>
                  {hasOfflinePin ? (
                    <>
                      <Text style={[styles.pinPromptTitle, { color: colors.text }]}>
                        Enter 4-Digit Offline PIN
                      </Text>
                      <Text style={[styles.pinPromptSubtitle, { color: colors.textSubtle }]}>
                        Instant access without internet
                      </Text>

                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => pinInputRef.current?.focus()}
                        style={styles.pinDotsRow}
                      >
                        {[0, 1, 2, 3].map((idx) => {
                          const isFilled = pin.length > idx;
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.pinDotCircle,
                                {
                                  borderColor: isFilled ? colors.primary : colors.border,
                                  backgroundColor: isFilled
                                    ? colors.primary
                                    : isDark
                                    ? "rgba(255,255,255,0.06)"
                                    : "#f1f5f9",
                                },
                              ]}
                            >
                              {isFilled ? <View style={styles.pinDotFill} /> : null}
                            </View>
                          );
                        })}
                      </TouchableOpacity>

                      <RNTextInput
                        ref={pinInputRef}
                        value={pin}
                        onChangeText={handlePinChange}
                        keyboardType="number-pad"
                        maxLength={4}
                        style={styles.hiddenPinInput}
                        autoFocus={true}
                      />

                      <Button
                        title="Unlock Offline Access"
                        variant="primary"
                        loading={isLoading}
                        disabled={pin.length !== 4}
                        icon={<CheckCircle2 size={16} color="#ffffff" />}
                        onPress={() => handlePinSubmit()}
                        style={{ marginTop: 12, width: "100%" }}
                      />
                    </>
                  ) : (
                    <View style={styles.noPinCard}>
                      <KeyRound size={28} color={colors.textMuted} style={{ marginBottom: 8 }} />
                      <Text style={[styles.noPinTitle, { color: colors.text }]}>
                        No Offline PIN Configured
                      </Text>
                      <Text style={[styles.noPinSubtitle, { color: colors.textSubtle }]}>
                        To use XPOS when offline, connect to the internet, sign in with your credentials, and configure an offline 4-digit PIN in App Settings.
                      </Text>
                      <Button
                        title="Use Password Sign In"
                        variant="secondary"
                        onPress={() => setLoginMode("password")}
                        style={{ marginTop: 14 }}
                      />
                    </View>
                  )}
                </View>
              )}
            </Card>

            {/* Server status footnote */}
            <TouchableOpacity
              onPress={openServerConfig}
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
    </SafeAreaView>
  );
}

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
  modeToggleRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  modeToggleBtnActive: {
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  modeToggleText: {
    fontSize: 13,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  offlineBannerText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  pinWrapper: {
    alignItems: "center",
    paddingVertical: 10,
  },
  pinPromptTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  pinPromptSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
    textAlign: "center",
  },
  pinDotsRow: {
    flexDirection: "row",
    gap: 16,
    marginVertical: 12,
    justifyContent: "center",
  },
  pinDotCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pinDotFill: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ffffff",
  },
  hiddenPinInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  noPinCard: {
    alignItems: "center",
    paddingVertical: 12,
  },
  noPinTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  noPinSubtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
