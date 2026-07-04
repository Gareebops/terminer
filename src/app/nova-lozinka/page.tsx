"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { TerminerLogo } from "@/components/terminer-logo";

// Odredište linka iz mejla za promenu lozinke (auth/callback?next=/nova-lozinka
// pravi sesiju pa preusmerava ovde). Bez sesije updateUser ne prolazi - u tom
// slučaju vodimo korisnika da zatraži nov link.
export default function NewPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Lozinka mora imati bar 8 karaktera.");
      return;
    }
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
      <Card className="w-full max-w-sm rounded-3xl border-0 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
        <CardHeader>
          <CardTitle>Nova lozinka</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova lozinka (min 8 karaktera)</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
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
