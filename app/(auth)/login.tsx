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
  type TextInput as RNTextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Store, Settings, Lock, User, Server, Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/utils/storage";
import { setDefaultApiBaseUrl } from "@/api/client";
import { DEFAULT_CONFIG } from "@/constants/config";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { haptics } from "@/utils/haptics";

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<RNTextInput>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(DEFAULT_CONFIG.API_BASE_URL);

  useFocusEffect(
    useCallback(() => {
      void storage.getApiBaseUrl().then((storedApi) => {
        if (storedApi) setApiBaseUrl(storedApi);
      });
    }, [])
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
});
