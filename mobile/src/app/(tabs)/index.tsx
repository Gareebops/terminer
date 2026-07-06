import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Font, Radius, Spacing } from "@/constants/theme";
import {
  fetchTenant,
  fetchTodayBookings,
  hourInZone,
  todayInZone,
} from "@/lib/data";
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from "@/lib/status";
import { supabase } from "@/lib/supabase";
import type { AdminTenant, TodayBooking } from "@/lib/types";

function terminaLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "termin";
  return "termina";
}

export default function PocetnaScreen() {
  const [tenant, setTenant] = useState<AdminTenant | null>(null);
  const [bookings, setBookings] = useState<TodayBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noSalon, setNoSalon] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const tenantRef = useRef<AdminTenant | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const t = tenantRef.current ?? (await fetchTenant());
      if (!t) {
        setNoSalon(true);
        return;
      }
      tenantRef.current = t;
      setTenant(t);
      setBookings(await fetchTodayBookings(t));
    } catch {
      setError(
        "Ne mogu da učitam podatke. Proveri internet, pa povuci nadole za osvežavanje."
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (noSalon) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Ovaj nalog nema salon</Text>
          <Text style={styles.emptyText}>
            Registruj salon na terminer.rs pa se prijavi ponovo.
          </Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => supabase.auth.signOut()}
          >
            <Text style={styles.secondaryButtonText}>Odjavi se</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const timezone = tenant?.timezone ?? "Europe/Belgrade";
  const hour = hourInZone(timezone);
  const greeting =
    hour < 10 ? "Dobro jutro" : hour < 18 ? "Dobar dan" : "Dobro veče";
  const rawDate = new Date(
    `${todayInZone(timezone)}T12:00:00`
  ).toLocaleDateString("sr-Latn-RS", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // sr-Latn-RS daje sve malim slovima — samo prvo slovo veliko.
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.salonName}>{tenant?.name ?? "…"}</Text>

        <View style={styles.darkCard}>
          <Text style={styles.darkCardLabel}>{dateLabel}</Text>
          <View style={styles.darkCardRow}>
            <Text style={styles.darkCardNumber}>
              {bookings ? bookings.length : "–"}
            </Text>
            <Text style={styles.darkCardUnit}>
              {terminaLabel(bookings?.length ?? 0)} danas
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Današnji termini</Text>

        {bookings && bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Danas nema termina</Text>
            <Text style={styles.emptyText}>
              Kad klijenti zakažu, termini će se pojaviti ovde.
            </Text>
          </View>
        ) : null}

        {(bookings ?? []).map((b) => {
          const statusColors = BOOKING_STATUS_COLORS[b.status];
          return (
            <View key={b.id} style={styles.bookingCard}>
              <View style={styles.bookingTime}>
                <Text style={styles.bookingStart}>{b.startTime}</Text>
                <Text style={styles.bookingEnd}>{b.endTime}</Text>
              </View>
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingService} numberOfLines={1}>
                  {b.serviceName}
                </Text>
                <Text style={styles.bookingCustomer} numberOfLines={1}>
                  {b.customerName}
                </Text>
                <Text style={styles.bookingStaff} numberOfLines={1}>
                  {b.staffName}
                </Text>
              </View>
              <View
                style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}
              >
                <Text style={[styles.statusText, { color: statusColors.text }]}>
                  {BOOKING_STATUS_LABELS[b.status]}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  greeting: {
    fontFamily: Font.medium,
    fontSize: 16,
    color: Colors.muted,
  },
  salonName: {
    fontFamily: Font.extrabold,
    fontSize: 30,
    color: Colors.ink,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  darkCard: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.outer,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  darkCardLabel: {
    fontFamily: Font.medium,
    fontSize: 14,
    color: Colors.inkOnDarkMuted,
  },
  darkCardRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  darkCardNumber: {
    fontFamily: Font.extrabold,
    fontSize: 48,
    color: Colors.mint,
  },
  darkCardUnit: {
    fontFamily: Font.semibold,
    fontSize: 16,
    color: Colors.white,
  },
  error: {
    fontFamily: Font.medium,
    fontSize: 14,
    color: "#B3261E",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Font.bold,
    fontSize: 18,
    color: Colors.ink,
    marginBottom: Spacing.md,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.outer,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontFamily: Font.bold,
    fontSize: 17,
    color: Colors.ink,
  },
  emptyText: {
    fontFamily: Font.medium,
    fontSize: 14,
    color: Colors.muted,
    textAlign: "center",
  },
  bookingCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.inner,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bookingTime: { alignItems: "center", minWidth: 48 },
  bookingStart: {
    fontFamily: Font.bold,
    fontSize: 16,
    color: Colors.ink,
  },
  bookingEnd: {
    fontFamily: Font.medium,
    fontSize: 12,
    color: Colors.muted,
  },
  bookingInfo: { flex: 1, gap: 1 },
  bookingService: {
    fontFamily: Font.semibold,
    fontSize: 15,
    color: Colors.ink,
  },
  bookingCustomer: {
    fontFamily: Font.medium,
    fontSize: 13,
    color: Colors.muted,
  },
  bookingStaff: {
    fontFamily: Font.medium,
    fontSize: 12,
    color: Colors.muted,
  },
  statusBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { fontFamily: Font.semibold, fontSize: 11 },
  secondaryButton: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.faint,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    marginTop: Spacing.md,
  },
  secondaryButtonText: {
    fontFamily: Font.semibold,
    fontSize: 14,
    color: Colors.ink,
  },
});
