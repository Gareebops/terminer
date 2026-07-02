import { notFound } from "next/navigation";
import { getTenantSite } from "@/lib/tenant";

// Boja brenda salona se ubacuje kao shadcn --primary promenljiva,
// pa sva dugmad i akcenti na sajtu i booking strani automatski
// dobijaju boju koju je vlasnik izabrao u Podešavanjima.
export default async function SalonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getTenantSite(slug);
  if (!site) notFound();

  const accent = site.settings?.primary_color ?? "#18181b";

  return (
    <div
      className="flex min-h-screen flex-1 flex-col"
      style={{ ["--primary" as string]: accent, ["--ring" as string]: accent }}
    >
      {children}
    </div>
  );
}
