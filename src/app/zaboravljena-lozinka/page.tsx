"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { TerminerLogo } from "@/components/terminer-logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/nova-lozinka`,
    });
    setLoading(false);
    if (error) {
      toast.error("Slanje nije uspelo. Proveri adresu pa pokušaj ponovo.");
      return;
    }
    // Namerno ista poruka i za nepostojeći nalog - ne odajemo ko ima nalog
    setSent(true);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-canvas px-4 py-16 font-display">
      <TerminerLogo href="/" />
      <Card className="w-full max-w-sm rounded-3xl border-0 shadow-card">
        {sent ? (
          <CardContent className="pt-10 pb-8 text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-mint text-ink">
              <MailCheck className="size-8" />
            </span>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
              Proveri sanduče
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ako nalog za <span className="font-semibold text-ink">{email}</span>{" "}
              postoji, stigao je mejl sa linkom za postavljanje nove lozinke.
            </p>
            <Button variant="ghost" className="mt-6" asChild>
              <Link href="/prijava">Nazad na prijavu</Link>
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-2xl font-extrabold tracking-tight">Zaboravljena lozinka</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email naloga</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="h-11"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="brand-mint" className="h-11 w-full" disabled={loading}>
                  {loading ? "Slanje..." : "Pošalji link za novu lozinku"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Setio si se?{" "}
                  <Link href="/prijava" className="underline">
                    Prijavi se
                  </Link>
                </p>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
