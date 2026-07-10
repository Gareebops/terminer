"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/password-input";
import { TerminerLogo } from "@/components/terminer-logo";

// Odredište linka iz mejla za promenu lozinke (auth/callback?next=/nova-lozinka
// pravi sesiju pa preusmerava ovde). Bez sesije updateUser ne prolazi - u tom
// slučaju vodimo korisnika da zatraži nov link.
export default function NewPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setFieldError("Lozinka mora imati bar 8 karaktera.");
      return;
    }
    setFieldError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("session")
          ? "Link je istekao ili je otvoren u drugom browseru - zatraži nov."
          : error.message.toLowerCase().includes("different")
            ? "Nova lozinka mora biti različita od stare."
            : "Promena nije uspela. Pokušaj ponovo."
      );
      return;
    }
    toast.success("Lozinka je promenjena.");
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-canvas px-4 py-16 font-display">
      <TerminerLogo href="/" />
      <Card className="w-full max-w-sm rounded-3xl border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">Nova lozinka</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova lozinka (min 8 karaktera)</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                className="h-11"
                required
                minLength={8}
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? "password-error" : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldError(null);
                }}
              />
              {fieldError && (
                <p id="password-error" className="text-xs font-medium text-red-700">
                  {fieldError}
                </p>
              )}
            </div>
            <Button type="submit" variant="brand-mint" className="h-11 w-full" disabled={loading}>
              {loading ? "Čuvanje..." : "Sačuvaj novu lozinku"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Link ne radi?{" "}
              <Link href="/zaboravljena-lozinka" className="underline">
                Zatraži nov
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
