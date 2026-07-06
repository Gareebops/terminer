import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Font, Radius, Spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

function porukaGreske(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Pogrešan email ili lozinka.";
  }
  if (message.includes("Email not confirmed")) {
    return "Email nije potvrđen — proveri sanduče.";
  }
  return "Prijava nije uspela. Pokušaj ponovo.";
}

export default function PrijavaScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Unesi email i lozinku.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);
    if (authError) setError(porukaGreske(authError.message));
    // Uspeh: Stack.Protected u root layoutu sam prebacuje na tabove.
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>Terminer</Text>
            <Text style={styles.tagline}>Tvoj salon, u džepu.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Prijavi se</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="salon@primer.rs"
              placeholderTextColor={Colors.muted}
              testID="email"
            />

            <Text style={styles.label}>Lozinka</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="••••••••"
              placeholderTextColor={Colors.muted}
              onSubmitEditing={handleLogin}
              testID="lozinka"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                pending && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={pending}
              testID="prijava-dugme"
            >
              {pending ? (
                <ActivityIndicator color={Colors.ink} />
              ) : (
                <Text style={styles.buttonText}>Prijavi se</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footer}>
            Nemaš nalog? Registruj salon na terminer.rs
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.lg,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  header: { alignItems: "center", marginBottom: Spacing.xl },
  logo: {
    fontFamily: Font.extrabold,
    fontSize: 40,
    color: Colors.ink,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: Font.medium,
    fontSize: 15,
    color: Colors.muted,
    marginTop: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.outer,
    padding: Spacing.lg,
  },
  title: {
    fontFamily: Font.extrabold,
    fontSize: 24,
    color: Colors.ink,
    marginBottom: Spacing.md,
  },
  label: {
    fontFamily: Font.semibold,
    fontSize: 13,
    color: Colors.ink,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.inner,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontFamily: Font.medium,
    fontSize: 16,
    color: Colors.ink,
  },
  error: {
    fontFamily: Font.medium,
    fontSize: 14,
    color: "#B3261E",
    marginTop: Spacing.md,
  },
  button: {
    backgroundColor: Colors.mint,
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: Font.bold,
    fontSize: 16,
    color: Colors.ink,
  },
  footer: {
    fontFamily: Font.medium,
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
