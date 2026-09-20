import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  Building2,
  GitBranch,
  Moon,
  Sun,
  LogOut,
  Server,
  Monitor,
  Check,
  Shield,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { fetchOrgs, fetchBranches, fetchTerminals } from "@/api/context";
import { isUuid } from "@/api/auth";
import { storage } from "@/utils/storage";
import { DEFAULT_CONFIG } from "@/constants/config";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { haptics } from "@/utils/haptics";
import type { Org, Branch, Terminal } from "@/types";

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { username, token, logout } = useAuth();
  const {
    orgId,
    orgName,
    branchId,
    branchName,
    terminalId,
    terminalName,
    setOrg,
    setBranch,
    setTerminal,
  } = useOrg();

  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [keycloakUrl, setKeycloakUrl] = useState("");
  const [realm, setRealm] = useState("");
  const [clientId, setClientId] = useState("");

  // Reload System Info values every time the screen is focused so that
  // changes saved in the config modal are immediately reflected here.
  useFocusEffect(
    useCallback(() => {
      void storage.getApiBaseUrl().then((u) => setApiBaseUrl(u ?? DEFAULT_CONFIG.API_BASE_URL));
      void storage.getKeycloakUrl().then((u) => setKeycloakUrl(u ?? DEFAULT_CONFIG.KEYCLOAK_URL));
      void storage.getRealm().then((r) => setRealm(r ?? DEFAULT_CONFIG.KEYCLOAK_REALM));
      void storage.getClientId().then((c) => setClientId(c ?? DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID));
    }, [])
  );


  const { data: orgsData } = useQuery({
    queryKey: ["context-orgs", token],
    queryFn: () => fetchOrgs(token),
    enabled: Boolean(token),
  });
  const orgs = orgsData?.content ?? [];

  // Fetch Branches
  const { data: branchesData } = useQuery({
    queryKey: ["context-branches", token, orgId],
    queryFn: () => fetchBranches(token, orgId!),
    enabled: Boolean(token && orgId),
  });
  const branches = branchesData?.content ?? [];

  // Fetch Terminals
  const { data: terminalsData } = useQuery({
    queryKey: ["context-terminals", token, orgId, branchId],
    queryFn: () => fetchTerminals(token, orgId!, branchId!),
    enabled: Boolean(token && orgId && branchId),
  });
  const showOrgSelector = orgs.length > 1;
  const showBranchSelector = branches.length > 1;
  const showOrgBranchSection = showOrgSelector || showBranchSelector;

  const handleLogout = async () => {
    haptics.warning();
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.card}>
          <View style={styles.userRow}>
            <View
              style={[
                styles.avatarBox,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <User size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {username && !isUuid(username) ? username : "Operator"}
              </Text>
              <Text style={[styles.userRole, { color: colors.textMuted }]}>
                {orgName ? `${orgName}${branchName ? ` • ${branchName}` : ""}` : "XPOS Store Operator"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                toggleTheme();
              }}
              style={[styles.themeIconBtn, { backgroundColor: colors.surfaceRaised }]}
              accessibilityLabel={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {isDark ? (
                <Moon size={18} color={colors.primary} />
              ) : (
                <Sun size={18} color={colors.warning} />
              )}
            </TouchableOpacity>
          </View>
        </Card>


        {/* Organization & Branch Selection (hidden if only 1 org and 1 branch) */}
        {showOrgBranchSection ? (
          <>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              ORGANIZATION & BRANCH
            </Text>
            <Card style={styles.card}>
              {showOrgSelector ? (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSubtle }]}>
                    Current Organization:
                  </Text>
                  <View style={styles.chipRow}>
                    {orgs.map((o: Org) => {
                      const isSelected = orgId === o.id;
                      return (
                        <TouchableOpacity
                          key={o.id}
                          onPress={() => {
                            haptics.light();
                            void setOrg(o.id, o.name);
                          }}
                          style={[
                            styles.contextChip,
                            {
                              backgroundColor: isSelected
                                ? colors.primaryLight
                                : colors.surfaceRaised,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Building2
                            size={14}
                            color={isSelected ? colors.primary : colors.textSubtle}
                          />
                          <Text
                            style={[
                              styles.contextChipText,
                              {
                                color: isSelected ? colors.primary : colors.text,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {o.name}
                          </Text>
                          {isSelected ? (
                            <Check size={14} color={colors.primary} />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* Branch Selection */}
              {showBranchSelector && orgId ? (
                <View style={{ marginTop: showOrgSelector ? 16 : 0 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSubtle }]}>
                    Current Branch:
                  </Text>
                  <View style={styles.chipRow}>
                    {branches.map((b: Branch) => {
                      const isSelected = branchId === b.id;
                      return (
                        <TouchableOpacity
                          key={b.id}
                          onPress={() => {
                            haptics.light();
                            void setBranch(b.id, b.name);
                          }}
                          style={[
                            styles.contextChip,
                            {
                              backgroundColor: isSelected
                                ? colors.primaryLight
                                : colors.surfaceRaised,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <GitBranch
                            size={14}
                            color={isSelected ? colors.primary : colors.textSubtle}
                          />
                          <Text
                            style={[
                              styles.contextChipText,
                              {
                                color: isSelected ? colors.primary : colors.text,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {b.name}
                          </Text>
                          {isSelected ? (
                            <Check size={14} color={colors.primary} />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}


        {/* Server & Connectivity */}
        <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
          SYSTEM INFO
        </Text>
        <Card style={styles.card}>
          <View style={styles.infoRow}>
            <Server size={16} color={colors.textSubtle} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Backend Server:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {apiBaseUrl}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Server size={16} color={colors.textSubtle} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Keycloak IAM:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {keycloakUrl}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Shield size={16} color={colors.textSubtle} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Realm / Client:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {realm} / {clientId}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Monitor size={16} color={colors.textSubtle} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Terminal:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {terminalName || (terminalId && !isUuid(terminalId) ? terminalId : "Main Terminal")}
            </Text>
          </View>
          {orgName ? (
            <View style={[styles.infoRow, { marginTop: 8 }]}>
              <Building2 size={16} color={colors.textSubtle} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                Organization:
              </Text>
              <Text style={[styles.infoVal, { color: colors.text }]}>
                {orgName}
              </Text>
            </View>
          ) : null}
          {branchName ? (
            <View style={[styles.infoRow, { marginTop: 8 }]}>
              <GitBranch size={16} color={colors.textSubtle} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                Branch:
              </Text>
              <Text style={[styles.infoVal, { color: colors.text }]}>
                {branchName}
              </Text>
            </View>
          ) : null}

          <Button
            title="Configure Server Endpoints"
            variant="secondary"
            icon={<Server size={16} color={colors.text} />}
            onPress={() => {
              haptics.light();
              router.push("/server-config");
            }}
            style={{ marginTop: 12 }}
          />
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out"
          variant="danger"
          icon={<LogOut size={18} color="#ffffff" />}
          onPress={handleLogout}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  card: {
    padding: 16,
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 17,
    fontWeight: "700",
  },
  userRole: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contextChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  contextChipText: {
    fontSize: 13,
  },
  themeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
});
