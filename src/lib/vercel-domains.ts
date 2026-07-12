// Vercel Domains API - deljeno između vlasničkih domain akcija
// (admin/domain-actions.ts) i superadmin panela (otkačivanje domena,
// čišćenje pri brisanju salona). Server-only modul.

export function vercelEnv() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID || null };
}

export async function vercelFetch(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: Record<string, unknown> }> {
  const env = vercelEnv()!;
  const url = new URL(`https://api.vercel.com${path}`);
  if (env.teamId) url.searchParams.set("teamId", env.teamId);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

// Skida domen sa Vercel projekta. Best-effort čišćenje: 404 (već skinut),
// mrežni pad i nepodešen env se gutaju - baza je izvor istine o domenu.
export async function removeDomainFromVercel(domain: string): Promise<void> {
  const env = vercelEnv();
  if (!env) return;
  await vercelFetch(`/v9/projects/${env.projectId}/domains/${domain}`, {
    method: "DELETE",
  }).catch(() => {});
}
