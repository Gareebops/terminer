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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "Nalog sa ovim emailom već postoji."
          : "Registracija nije uspela. Pokušaj ponovo."
      );
      return;
    }
    // Ako je email potvrda uključena u Supabase, session je null dok se ne potvrdi.
    if (!data.session) {
      toast.success("Proveri email i potvrdi nalog, pa se prijavi.");
      router.push("/prijava");
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Registruj svoj salon</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="password">Lozinka (min 8 karaktera)</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Kreiranje naloga..." : "Napravi nalog"}
            </Button>
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
