import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Store, Settings, Lock, User, Server } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/utils/storage";
import { setDefaultApiBaseUrl } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { haptics } from "@/utils/haptics";

export const LoginScreen: React.FC = () => {
  const { colors } = useTheme();
  const { login, isLoading } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Server settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:9003");
  const [keycloakUrl, setKeycloakUrl] = useState("http://localhost:8080");
  const [realm, setRealm] = useState("xpos");
  const [clientId, setClientId] = useState("xpos-frontend");

  useEffect(() => {
    async function loadSettings() {
      const storedApi = await storage.getApiBaseUrl();
      if (storedApi) setApiBaseUrl(storedApi);
      const storedKc = await storage.getKeycloakUrl();
      if (storedKc) setKeycloakUrl(storedKc);
    }
    void loadSettings();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setErrorMsg("Please enter both username and password");
      return;
    }
    setErrorMsg("");
    try {
      setDefaultApiBaseUrl(apiBaseUrl);
      await login({
        keycloakUrl,
        realm,
        clientId,
        username: username.trim(),
        password,
      });
      haptics.success();
    } catch (err: any) {
      haptics.error();
      setErrorMsg(err.message ?? "Login failed. Check server connection.");
    }
  };

  const handleSaveSettings = async () => {
    await storage.setApiBaseUrl(apiBaseUrl);
    await storage.setKeycloakUrl(keycloakUrl);
    setDefaultApiBaseUrl(apiBaseUrl);
    setSettingsOpen(false);
    haptics.success();
    Alert.alert("Saved", "Server configuration updated.");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Settings Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => setSettingsOpen(true)}
              style={[styles.settingsBtn, { backgroundColor: colors.surfaceRaised }]}
            >
              <Settings size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

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
              leftIcon={<User size={18} color={colors.textSubtle} />}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              leftIcon={<Lock size={18} color={colors.textSubtle} />}
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
          >
            <Server size={14} color={colors.textSubtle} />
            <Text style={[styles.serverText, { color: colors.textSubtle }]}>
              API: {apiBaseUrl}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Settings Modal */}
      <Modal visible={settingsOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Server Configuration
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Configure Spring Boot API and Keycloak IAM endpoints. Use your LAN IP
              when testing on a physical phone.
            </Text>

            <Input
              label="XPOS Backend API URL"
              value={apiBaseUrl}
              onChangeText={setApiBaseUrl}
              placeholder="http://192.168.1.100:9003"
              autoCapitalize="none"
            />

            <Input
              label="Keycloak Server URL"
              value={keycloakUrl}
              onChangeText={setKeycloakUrl}
              placeholder="http://192.168.1.100:8080"
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
          </View>
        </View>
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
  topBar: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  settingsBtn: {
    padding: 10,
    borderRadius: 12,
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
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalBtns: {
    flexDirection: "row",
    marginTop: 8,
  },
});
