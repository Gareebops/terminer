"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@/components/icons";
import { Input } from "@/components/ui/input";

// Polje za lozinku sa "prikaži/sakrij" - na telefonu je kucanje naslepo
// čest uzrok pogrešne lozinke pri registraciji
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={`pr-11 ${className ?? ""}`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? "Sakrij lozinku" : "Prikaži lozinku"}
        title={visible ? "Sakrij lozinku" : "Prikaži lozinku"}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
