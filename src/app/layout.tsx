import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

// Terminer brend font (admin, landing, auth) - sajtovi salona imaju svoje parove
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  // Apsolutna osnova za og:image i ostale relativne URL-ove u metapodacima
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://terminer.rs"),
  title: {
    default: "Terminer - online zakazivanje za salone",
    template: "%s | Terminer",
  },
  description:
    "Terminer je platforma za frizerske i beauty salone: sopstveni mini-sajt i online zakazivanje termina za par minuta.",
  openGraph: {
    type: "website",
    locale: "sr_RS",
    siteName: "Terminer",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sr"
      className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans antialiased">
        {children}
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}
