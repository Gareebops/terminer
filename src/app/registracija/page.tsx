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
import { AuthDivider, GoogleButton } from "@/components/google-button";
import { PasswordInput } from "@/components/password-input";
import { TerminerLogo } from "@/components/terminer-logo";

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
    // Postojeći potvrđen nalog: Supabase sa uključenom email potvrdom NE
    // vraća grešku (anti-enumeration) nego "uspeh" sa praznim identities -
    // bez ove provere korisnik bi čekao mejl koji nikad ne stiže
    if (data.user && data.user.identities?.length === 0) {
      toast.error("Nalog sa ovim emailom već postoji.", {
        action: { label: "Prijavi se", onClick: () => router.push("/prijava") },
      });
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
      <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-canvas px-4 py-16 font-display">
        <TerminerLogo href="/" />
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
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-canvas px-4 py-16 font-display">
      <TerminerLogo href="/" />
      <Card className="w-full max-w-sm rounded-3xl border-0 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">Registruj salon ili studio</CardTitle>
          {/* Najjači argument sa landinga ponovljen na koraku odluke */}
          <p className="text-sm text-muted-foreground">
            Prvih <span className="font-semibold text-ink">30 dana besplatno</span> - bez
            kartice, bez obaveze.
          </p>
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
              <PasswordInput
                id="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full rounded-full bg-mint font-bold text-ink hover:bg-mint/85" disabled={loading}>
              {loading ? "Kreiranje naloga..." : "Napravi nalog"}
            </Button>
            <AuthDivider />
            <GoogleButton label="Registruj se Google nalogom" />
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
