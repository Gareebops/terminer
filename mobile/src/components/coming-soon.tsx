import Feather from "@expo/vector-icons/Feather";
import * as WebBrowser from "expo-web-browser";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Font, Radius, Spacing } from "@/constants/theme";

// Privremeni ekran za tabove koji stižu u narednim fazama — do tada
// vlasnika vodimo na web admin koji sve već ume.
export function ComingSoon({
  icon,
  title,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <View style={styles.iconCircle}>
          <Feather name={icon} size={28} color={Colors.ink} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>
          Ovaj deo aplikacije stiže uskoro. Do tada je sve dostupno u web
          adminu.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() =>
            WebBrowser.openBrowserAsync("https://terminer.rs/admin")
          }
        >
          <Text style={styles.buttonText}>Otvori web admin</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: Colors.mint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: Font.extrabold,
    fontSize: 22,
    color: Colors.ink,
  },
  text: {
    fontFamily: Font.medium,
    fontSize: 14,
    color: Colors.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  button: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.faint,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    marginTop: Spacing.md,
  },
  buttonText: {
    fontFamily: Font.semibold,
    fontSize: 14,
    color: Colors.ink,
  },
});
