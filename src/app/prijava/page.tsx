"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { TerminerLogo } from "@/components/terminer-logo";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  // Dolazak sa linka za potvrdu naloga (auth/callback bez sesije)
  const justConfirmed = search.get("potvrdjen") === "1";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("not confirmed")) {
        setUnconfirmed(true);
        toast.error("Nalog još nije potvrđen - proveri mejl.");
      } else {
        toast.error("Pogrešan email ili lozinka.");
      }
      return;
    }
    router.push(search.get("next") ?? "/admin");
    router.refresh();
  }

  async function resendConfirmation() {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error("Slanje nije uspelo. Sačekaj minut pa probaj opet.");
    else toast.success(`Nova potvrda je poslata na ${email}.`);
  }

  return (
    <Card className="w-full max-w-sm rounded-3xl border-0 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
      <CardHeader>
        <CardTitle>Prijava</CardTitle>
      </CardHeader>
      <CardContent>
        {justConfirmed && (
          <p className="mb-4 rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-ink">
            Nalog je potvrđen - prijavi se i nastavi sa podešavanjem salona.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Lozinka</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Prijavljivanje..." : "Prijavi se"}
          </Button>
          {unconfirmed && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={resendConfirmation}
            >
              Pošalji ponovo link za potvrdu
            </Button>
          )}
          <p className="text-center text-sm text-muted-foreground">
            Nemaš nalog?{" "}
            <Link href="/registracija" className="underline">
              Registruj salon
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-canvas px-4 py-16 font-display">
      <TerminerLogo href="/" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
