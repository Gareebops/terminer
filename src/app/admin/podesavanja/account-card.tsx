"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/password-input";

// Kartica "Nalog" u Podešavanjima: promena lozinke bez odjave. Supabase
// updateUser ne traži staru lozinku, pa je sami proveravamo kroz
// signInWithPassword - otvoren admin tab (npr. zajednički računar u salonu)
// inače ne sme da bude dovoljan za preuzimanje naloga. Nalog prijavljen SAMO
// preko Google-a lozinku nema - njemu ista forma znači "postavi lozinku"
// (dodatna prijava mejlom), bez polja za trenutnu.
export function AccountCard({
  email,
  hasPassword: initialHasPassword,
}: {
  email: string;
  hasPassword: boolean;
}) {
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  // Polja su sklopljena dok se ne klikne "Promeni/Postavi lozinku" -
  // retka radnja ne zaslužuje dva stalno otvorena input polja
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});

  function close() {
    setOpen(false);
    setCurrent("");
    setNext("");
    setErrors({});
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (hasPassword && !current) errs.current = "Upiši trenutnu lozinku.";
    if (next.length < 8) errs.next = "Lozinka mora imati bar 8 karaktera.";
    if (hasPassword && current && next && current === next)
      errs.next = "Nova lozinka mora biti različita od trenutne.";
    setErrors(errs);
    if (errs.current || errs.next) return;

    setLoading(true);
    const supabase = createClient();
    // try/catch: mrežni pad server poziva ne sme da ostane unhandled
    try {
      if (hasPassword) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: current,
        });
        if (error) {
          setErrors({ current: "Trenutna lozinka nije tačna." });
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        toast.error(
          error.message.toLowerCase().includes("different")
            ? "Nova lozinka mora biti različita od trenutne."
            : "Promena nije uspela. Pokušaj ponovo."
        );
        return;
      }
      toast.success(hasPassword ? "Lozinka je promenjena." : "Lozinka je postavljena.");
      setHasPassword(true);
      close();
    } catch {
      toast.error("Nešto nije uspelo. Proveri vezu pa pokušaj ponovo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" /> Nalog
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Prijava na Terminer ide preko{" "}
          <span className="font-semibold text-foreground">{email}</span>.
          {!hasPassword &&
            " Trenutno se prijavljuješ Google nalogom - ako postaviš lozinku, moći ćeš da se prijaviš i mejlom."}
        </p>

        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            {hasPassword ? "Promeni lozinku" : "Postavi lozinku"}
          </Button>
        ) : (
          /* noValidate: native required balončić bi preduhitrio srpsku poruku */
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="acc-current">Trenutna lozinka</Label>
                <PasswordInput
                  id="acc-current"
                  autoComplete="current-password"
                  autoFocus
                  required
                  aria-invalid={!!errors.current}
                  aria-describedby={errors.current ? "acc-current-error" : undefined}
                  value={current}
                  onChange={(e) => {
                    setCurrent(e.target.value);
                    setErrors((f) => ({ ...f, current: undefined }));
                  }}
                />
                {errors.current && (
                  <p id="acc-current-error" className="text-xs font-medium text-red-700">
                    {errors.current}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="acc-next">Nova lozinka (min 8 karaktera)</Label>
              <PasswordInput
                id="acc-next"
                autoComplete="new-password"
                autoFocus={!hasPassword}
                required
                minLength={8}
                aria-invalid={!!errors.next}
                aria-describedby={errors.next ? "acc-next-error" : undefined}
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  setErrors((f) => ({ ...f, next: undefined }));
                }}
              />
              {errors.next && (
                <p id="acc-next-error" className="text-xs font-medium text-red-700">
                  {errors.next}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading
                  ? "Čuvanje..."
                  : hasPassword
                    ? "Sačuvaj novu lozinku"
                    : "Sačuvaj lozinku"}
              </Button>
              <Button type="button" variant="ghost" disabled={loading} onClick={close}>
                Odustani
              </Button>
              {hasPassword && (
                <Link
                  href="/zaboravljena-lozinka"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Ne sećaš se trenutne lozinke?
                </Link>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
