import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Font, Radius, Spacing } from "@/constants/theme";
import { clearTenantCache, fetchTenant } from "@/lib/data";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import type { AdminTenant } from "@/lib/types";

function Row({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <Feather name={icon} size={18} color={Colors.ink} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Feather name="chevron-right" size={18} color={Colors.muted} />
    </Pressable>
  );
}

export default function ViseScreen() {
  const { session } = useSession();
  const [tenant, setTenant] = useState<AdminTenant | null>(null);

  useEffect(() => {
    fetchTenant()
      .then(setTenant)
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    clearTenantCache();
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Više</Text>

        <View style={styles.card}>
          <Text style={styles.salonName}>{tenant?.name ?? "…"}</Text>
          {tenant ? (
            <Text style={styles.salonSlug}>terminer.rs/{tenant.slug}</Text>
          ) : null}
          <Text style={styles.email}>{session?.user.email ?? ""}</Text>
        </View>

        <View style={styles.card}>
          <Row
            icon="globe"
            label="Pogledaj sajt salona"
            onPress={() =>
              tenant &&
              WebBrowser.openBrowserAsync(`https://terminer.rs/${tenant.slug}`)
            }
          />
          <View style={styles.divider} />
          <Row
            icon="external-link"
            label="Otvori web admin"
            onPress={() =>
              WebBrowser.openBrowserAsync("https://terminer.rs/admin")
            }
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.rowPressed,
          ]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Odjavi se</Text>
        </Pressable>

        <Text style={styles.version}>
          Terminer {Constants.expoConfig?.version ?? ""}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  scroll: {
    padding: Spacing.lg,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontFamily: Font.extrabold,
    fontSize: 30,
    color: Colors.ink,
    letterSpacing: -0.5,
    marginBottom: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.outer,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  salonName: {
    fontFamily: Font.bold,
    fontSize: 20,
    color: Colors.ink,
  },
  salonSlug: {
    fontFamily: Font.medium,
    fontSize: 14,
    color: Colors.muted,
    marginTop: 2,
  },
  email: {
    fontFamily: Font.medium,
    fontSize: 13,
    color: Colors.muted,
    marginTop: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rowPressed: { opacity: 0.6 },
  rowLabel: {
    flex: 1,
    fontFamily: Font.semibold,
    fontSize: 15,
    color: Colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.faint,
    marginVertical: Spacing.sm,
  },
  signOutButton: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.faint,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  signOutText: {
    fontFamily: Font.semibold,
    fontSize: 15,
    color: "#B3261E",
  },
  version: {
    fontFamily: Font.medium,
    fontSize: 12,
    color: Colors.muted,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
