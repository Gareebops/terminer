"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Kada je email potvrda uključena, umesto redirekcije prikazujemo uputstvo
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fullName.trim().split(/\s+/).length < 2) {
      toast.error("Unesi ime i prezime.");
      return;
    }
    if (!/^\+?[0-9 /-]{6,20}$/.test(phone.trim())) {
      toast.error("Unesi ispravan broj telefona.");
      return;
    }
    if (password.length < 8) {
      toast.error("Lozinka mora imati bar 8 karaktera.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim(), phone: phone.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "Nalog sa ovim emailom već postoji."
          : "Registracija nije uspela. Pokušaj ponovo."
      );
      return;
    }
    // Email potvrda uključena → session je null dok korisnik ne klikne link
    if (!data.session) {
      setAwaitingConfirm(true);
      return;
    }
    router.push("/onboarding");
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

  if (awaitingConfirm) {
    return (
      <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16 font-display">
        <Card className="w-full max-w-sm rounded-3xl border-0 text-center shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
          <CardContent className="pt-10 pb-8">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-mint text-ink">
              <MailCheck className="size-8" />
            </span>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
              Proveri sanduče
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Poslali smo link za potvrdu naloga na{" "}
              <span className="font-semibold text-ink">{email}</span>. Klikni ga
              da aktiviraš nalog - pa nastavljaš pravo na podešavanje salona.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Ne vidiš mejl? Pogledaj spam ili promocije.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="outline" onClick={resendConfirmation}>
                Pošalji ponovo
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/prijava">Nazad na prijavu</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16 font-display">
      <Card className="w-full max-w-sm rounded-3xl border-0 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
        <CardHeader>
          <CardTitle>Registruj svoj salon</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Ime i prezime</Label>
              <Input
                id="full-name"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="06x xxx xxxx"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Lozinka (min 8 karaktera)</Label>
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
              {loading ? "Kreiranje naloga..." : "Napravi nalog"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Registracijom prihvataš{" "}
              <Link href="/uslovi" className="underline">
                uslove korišćenja
              </Link>{" "}
              i{" "}
              <Link href="/privatnost" className="underline">
                politiku privatnosti
              </Link>
              .
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Već imaš nalog?{" "}
              <Link href="/prijava" className="underline">
                Prijavi se
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
