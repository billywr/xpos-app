import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
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
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { fetchOrgs, fetchBranches, fetchTerminals } from "@/api/context";
import { storage } from "@/utils/storage";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { haptics } from "@/utils/haptics";
import type { Org, Branch, Terminal } from "@/types";

export const SettingsScreen: React.FC = () => {
  const { colors, isDark, toggleTheme, themeMode, setThemeMode } = useTheme();
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

  useEffect(() => {
    storage.getApiBaseUrl().then((u) => setApiBaseUrl(u ?? "http://localhost:9003"));
  }, []);

  // Fetch Orgs
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
  const terminals = terminalsData?.content ?? [];

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          haptics.warning();
          void logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
                {username ?? "Operator"}
              </Text>
              <Text style={[styles.userRole, { color: colors.textMuted }]}>
                XPOS Store Operator
              </Text>
            </View>
          </View>
        </Card>

        {/* Organization Selection */}
        <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
          ORGANIZATION & BRANCH
        </Text>
        <Card style={styles.card}>
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

          {/* Branch Selection */}
          {orgId ? (
            <View style={{ marginTop: 16 }}>
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

        {/* Appearance Settings */}
        <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
          APPEARANCE & THEME
        </Text>
        <Card style={styles.card}>
          <View style={styles.themeRow}>
            <View style={styles.themeInfo}>
              {isDark ? (
                <Moon size={20} color={colors.primary} />
              ) : (
                <Sun size={20} color={colors.warning} />
              )}
              <Text style={[styles.themeLabel, { color: colors.text }]}>
                {isDark ? "Dark Theme" : "Light Theme"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                toggleTheme();
              }}
              style={[
                styles.themeToggleBtn,
                { backgroundColor: colors.surfaceRaised },
              ]}
            >
              <Text style={[styles.toggleBtnText, { color: colors.primary }]}>
                Switch to {isDark ? "Light" : "Dark"}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

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
            <Monitor size={16} color={colors.textSubtle} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Terminal ID:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {terminalId || "term-1"}
            </Text>
          </View>
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
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  themeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  themeLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  themeToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: "600",
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
