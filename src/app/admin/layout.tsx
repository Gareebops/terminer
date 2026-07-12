import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getAdminContext } from "@/lib/admin";
import { subscriptionInfo } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { isAppearanceTouched, type GuideData } from "@/lib/guide";
import type { OnboardingState, SiteSettings } from "@/lib/types";
import { CONTACT_EMAIL } from "@/components/legal-page";
import { AdminNav } from "./admin-nav";
import { GuideRail } from "./guide-rail";
import { LogoutButton } from "./logout-button";
import { MobileHeader } from "./mobile-header";
import { PresencePing } from "./presence-ping";
import { PublishControl } from "./publish-control";
import { SubscriptionBanner } from "./subscription-banner";
import { SupportChat } from "./support-chat";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenant } = await getAdminContext();
  const sub = subscriptionInfo(tenant);

  // Traka vodiča prati vlasnika po celom adminu dok vodič traje. Upiti se
  // rade SAMO dok sajt nije objavljen (svež salon, malo podataka) - posle
  // objave ili sakrivanja vodiča redovan rad ne plaća ništa.
  let guideData: GuideData | null = null;
  if (!tenant.is_published && !tenant.suspended_at) {
    const supabase = await createClient();
    const [settingsRes, servicesRes, staffRes] = await Promise.all([
      supabase.from("site_settings").select("*").eq("tenant_id", tenant.id).maybeSingle(),
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id),
      supabase.from("staff").select("id").eq("tenant_id", tenant.id).eq("is_active", true),
    ]);
    const settings = (settingsRes.data ?? null) as SiteSettings | null;
    const onboarding = (settings?.onboarding ?? {}) as OnboardingState;
    if (!onboarding.guide_hidden) {
      const staffIds = ((staffRes.data ?? []) as { id: string }[]).map((s) => s.id);
      guideData = {
        servicesCount: servicesRes.count ?? 0,
        staffCount: staffIds.length,
        scheduleConfirmed: !!onboarding.schedule_confirmed,
        appearanceTouched: isAppearanceTouched(settings),
        appearanceConfirmed: !!onboarding.appearance_confirmed,
        singleStaffId: staffIds.length === 1 ? staffIds[0] : null,
      };
    }
  }

  return (
    <div
      className="admin-scope flex min-h-screen flex-1 flex-col gap-4 bg-canvas p-4 font-display text-ink lg:flex-row"
      style={{ ["--radius" as string]: "1rem" }}
    >
      <MobileHeader
        tenantName={tenant.name}
        slug={tenant.slug}
        isPublished={tenant.is_published}
        suspended={!!tenant.suspended_at}
      />
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col rounded-[2rem] bg-ink text-white lg:flex">
        <div className="p-5 pb-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
            Terminer
          </p>
          <p className="mt-1.5 truncate text-lg font-bold tracking-tight">
            {tenant.name}
          </p>
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className="mt-1 flex items-center gap-1 text-xs text-white/50 hover:text-white"
          >
            /{tenant.slug} <ExternalLink className="size-3" />
          </Link>
        </div>
        <div className="px-3 pt-2">
          <PublishControl
            slug={tenant.slug}
            isPublished={tenant.is_published}
            suspended={!!tenant.suspended_at}
            variant="sidebar"
          />
        </div>
        <AdminNav />
        <div className="border-t border-white/10 p-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 lg:py-2 lg:pr-2">
        {tenant.suspended_at && (
          <div className="mb-4 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white">
            Salon je suspendovan i sajt nije javno dostupan.
            {tenant.suspended_reason && ` Razlog: ${tenant.suspended_reason}.`}{" "}
            Kontaktiraj podršku: {CONTACT_EMAIL}
          </div>
        )}
        <SubscriptionBanner status={sub.status} daysLeft={sub.daysLeft} />
        {guideData && <GuideRail data={guideData} />}
        {children}
      </main>
      <SupportChat />
      <PresencePing />
    </div>
  );
}
