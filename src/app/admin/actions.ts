"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromMinutes, toMinutes } from "@/lib/booking/slots";
import { zonedToUtc } from "@/lib/booking/timezone";
import { PLANS, type PlanId } from "@/lib/invoice";
import type { BookingStatus } from "@/lib/types";

// Sve admin akcije koriste session klijent — RLS propušta samo redove
// salona čiji je korisnik član, pa tenant_id sa klijenta ne primamo nigde.

type ActionResult = { ok: boolean; error?: string };

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<ActionResult> {
  await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);
  if (error) return { ok: false, error: "Izmena nije uspela." };
  revalidatePath("/admin/rezervacije");
  return { ok: true };
}

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Unesi naziv usluge.").max(100),
  description: z.string().trim().max(300).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0),
  isActive: z.boolean(),
});

export async function upsertService(
  input: z.infer<typeof serviceSchema>
): Promise<ActionResult> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const row = {
    tenant_id: tenant.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    duration_minutes: parsed.data.durationMinutes,
    price: parsed.data.price,
    is_active: parsed.data.isActive,
  };

  const { data: service, error } = parsed.data.id
    ? await supabase.from("services").update(row).eq("id", parsed.data.id).select("id").single()
    : await supabase.from("services").insert(row).select("id").single();

  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  // Nova usluga se podrazumevano dodeljuje svim zaposlenima
  if (!parsed.data.id) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("tenant_id", tenant.id);
    if (staff && staff.length > 0) {
      await supabase.from("staff_services").insert(
        staff.map((s) => ({
          tenant_id: tenant.id,
          staff_id: s.id,
          service_id: service.id,
        }))
      );
    }
  }

  revalidatePath("/admin/usluge");
  return { ok: true };
}

export async function deleteService(id: string): Promise<ActionResult> {
  await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    // 23503 = FK sa bookings — usluga ima istoriju, samo je deaktiviraj
    if (error.code === "23503") {
      await supabase.from("services").update({ is_active: false }).eq("id", id);
      revalidatePath("/admin/usluge");
      return { ok: true };
    }
    return { ok: false, error: "Brisanje nije uspelo." };
  }
  revalidatePath("/admin/usluge");
  return { ok: true };
}

const staffSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Unesi ime.").max(100),
  bio: z.string().trim().max(300).optional(),
  isActive: z.boolean(),
});

export async function upsertStaff(
  input: z.infer<typeof staffSchema>
): Promise<ActionResult> {
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const row = {
    tenant_id: tenant.id,
    name: parsed.data.name,
    bio: parsed.data.bio || null,
    is_active: parsed.data.isActive,
  };

  if (parsed.data.id) {
    const { error } = await supabase.from("staff").update(row).eq("id", parsed.data.id);
    if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  } else {
    const { data: member, error } = await supabase
      .from("staff")
      .insert(row)
      .select("id")
      .single();
    if (error) return { ok: false, error: "Čuvanje nije uspelo." };

    // Podrazumevano: radi sve usluge, pon–sub 09–20 (menja se u Zaposleni)
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("tenant_id", tenant.id);
    await Promise.all([
      services && services.length > 0
        ? supabase.from("staff_services").insert(
            services.map((s) => ({
              tenant_id: tenant.id,
              staff_id: member.id,
              service_id: s.id,
            }))
          )
        : Promise.resolve(),
      supabase.from("working_hours").insert(
        Array.from({ length: 7 }, (_, dow) => ({
          tenant_id: tenant.id,
          staff_id: member.id,
          day_of_week: dow,
          start_time: "09:00",
          end_time: "20:00",
          is_working: dow !== 0,
        }))
      ),
    ]);
  }

  revalidatePath("/admin/zaposleni");
  return { ok: true };
}

export async function deleteStaff(id: string): Promise<ActionResult> {
  await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      await supabase.from("staff").update({ is_active: false }).eq("id", id);
      revalidatePath("/admin/zaposleni");
      return { ok: true };
    }
    return { ok: false, error: "Brisanje nije uspelo." };
  }
  revalidatePath("/admin/zaposleni");
  return { ok: true };
}

export async function updateStaffServices(
  staffId: string,
  serviceIds: string[]
): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  // Prihvati samo usluge koje stvarno pripadaju ovom salonu
  const { data: valid } = await supabase
    .from("services")
    .select("id")
    .eq("tenant_id", tenant.id)
    .in("id", serviceIds.length > 0 ? serviceIds : ["00000000-0000-0000-0000-000000000000"]);
  const validIds = (valid ?? []).map((s) => s.id);

  const { error: delError } = await supabase
    .from("staff_services")
    .delete()
    .eq("staff_id", staffId);
  if (delError) return { ok: false, error: "Čuvanje nije uspelo." };

  if (validIds.length > 0) {
    const { error } = await supabase.from("staff_services").insert(
      validIds.map((serviceId) => ({
        tenant_id: tenant.id,
        staff_id: staffId,
        service_id: serviceId,
      }))
    );
    if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  }

  revalidatePath(`/admin/zaposleni/${staffId}`);
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

const workingHoursSchema = z.array(
  z
    .object({
      dayOfWeek: z.number().int().min(0).max(6),
      isWorking: z.boolean(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .refine((d) => !d.isWorking || d.startTime < d.endTime, {
      message: "Početak mora biti pre kraja radnog vremena.",
    })
);

export async function updateWorkingHours(
  staffId: string,
  hours: z.infer<typeof workingHoursSchema>
): Promise<ActionResult> {
  const parsed = workingHoursSchema.safeParse(hours);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { error } = await supabase.from("working_hours").upsert(
    parsed.data.map((h) => ({
      tenant_id: tenant.id,
      staff_id: staffId,
      day_of_week: h.dayOfWeek,
      start_time: h.startTime,
      end_time: h.endTime,
      is_working: h.isWorking,
    })),
    { onConflict: "staff_id,day_of_week" }
  );
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  revalidatePath(`/admin/zaposleni/${staffId}`);
  return { ok: true };
}

const shiftTemplateSchema = z
  .object({
    id: z.string().optional(),
    staffId: z.string().min(1),
    name: z.string().trim().min(1, "Unesi naziv smene.").max(60),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "Početak smene mora biti pre kraja.",
  });

export async function upsertShiftTemplate(
  input: z.infer<typeof shiftTemplateSchema>
): Promise<ActionResult> {
  const parsed = shiftTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const row = {
    tenant_id: tenant.id,
    staff_id: parsed.data.staffId,
    name: parsed.data.name,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  };

  const { error } = parsed.data.id
    ? await supabase.from("shift_templates").update(row).eq("id", parsed.data.id)
    : await supabase.from("shift_templates").insert(row);

  if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  revalidatePath(`/admin/zaposleni/${parsed.data.staffId}`);
  revalidatePath("/admin/smene");
  return { ok: true };
}

export async function deleteShiftTemplate(id: string): Promise<ActionResult> {
  await getAdminContext();
  const supabase = await createClient();
  // Brisanjem šablona kaskadno nestaju i njegove dodele po datumima
  const { error } = await supabase.from("shift_templates").delete().eq("id", id);
  if (error) return { ok: false, error: "Brisanje nije uspelo." };
  revalidatePath("/admin/smene");
  revalidatePath("/admin/zaposleni");
  return { ok: true };
}

const assignmentSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // "default" = obriši dodelu (važi radno vreme), "off" = slobodan dan, inače id šablona
  value: z.string().min(1),
});

export async function setShiftAssignment(
  input: z.infer<typeof assignmentSchema>
): Promise<ActionResult> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };

  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const { staffId, date, value } = parsed.data;

  if (value === "default") {
    const { error } = await supabase
      .from("shift_assignments")
      .delete()
      .eq("staff_id", staffId)
      .eq("date", date);
    if (error) return { ok: false, error: "Izmena nije uspela." };
  } else {
    if (value !== "off") {
      // Šablon mora pripadati baš ovom zaposlenom
      const { data: tpl } = await supabase
        .from("shift_templates")
        .select("id")
        .eq("id", value)
        .eq("staff_id", staffId)
        .maybeSingle();
      if (!tpl) return { ok: false, error: "Smena nije pronađena." };
    }
    const { error } = await supabase.from("shift_assignments").upsert(
      {
        tenant_id: tenant.id,
        staff_id: staffId,
        date,
        shift_template_id: value === "off" ? null : value,
        is_off: value === "off",
      },
      { onConflict: "staff_id,date" }
    );
    if (error) return { ok: false, error: "Izmena nije uspela." };
  }

  revalidatePath("/admin/smene");
  return { ok: true };
}

const adminBookingSchema = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().trim().min(2, "Unesi ime klijenta.").max(100),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 /-]{6,20}$/, "Unesi ispravan broj telefona."),
  note: z.string().trim().max(500).optional(),
});

// Ručno zakazivanje za klijente koji zovu telefonom. Namerno ne proverava
// radno vreme/smene — salon zna šta radi; jedino preklapanje termina brani baza.
export async function adminCreateBooking(
  input: z.infer<typeof adminBookingSchema>
): Promise<ActionResult> {
  const parsed = adminBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const d = parsed.data;

  const [serviceRes, staffRes] = await Promise.all([
    supabase
      .from("services")
      .select("id, duration_minutes")
      .eq("id", d.serviceId)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabase
      .from("staff")
      .select("id")
      .eq("id", d.staffId)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
  ]);
  if (!serviceRes.data || !staffRes.data) {
    return { ok: false, error: "Usluga ili zaposleni nisu pronađeni." };
  }

  const endTime = fromMinutes(toMinutes(d.time) + serviceRes.data.duration_minutes);

  const { data: customer } = await supabase
    .from("customers")
    .upsert(
      { tenant_id: tenant.id, name: d.customerName, phone: d.customerPhone },
      { onConflict: "tenant_id,phone" }
    )
    .select("id")
    .maybeSingle();

  const { error } = await supabase.from("bookings").insert({
    tenant_id: tenant.id,
    staff_id: d.staffId,
    service_id: d.serviceId,
    customer_id: customer?.id ?? null,
    customer_name: d.customerName,
    customer_phone: d.customerPhone,
    date: d.date,
    start_time: d.time,
    end_time: endTime,
    starts_at: zonedToUtc(d.date, d.time, tenant.timezone).toISOString(),
    ends_at: zonedToUtc(d.date, endTime, tenant.timezone).toISOString(),
    note: d.note || null,
    status: "confirmed",
  });

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Termin se preklapa sa postojećom rezervacijom." };
    }
    return { ok: false, error: "Zakazivanje nije uspelo." };
  }

  revalidatePath("/admin/kalendar");
  revalidatePath("/admin/rezervacije");
  return { ok: true };
}

const blockedSlotSchema = z
  .object({
    staffId: z.string().optional(), // undefined/"" = ceo salon
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "Početak mora biti pre kraja.",
  });

export async function createBlockedSlot(
  input: z.infer<typeof blockedSlotSchema>
): Promise<ActionResult> {
  const parsed = blockedSlotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { error } = await supabase.from("blocked_slots").insert({
    tenant_id: tenant.id,
    staff_id: parsed.data.staffId || null,
    date: parsed.data.date,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    reason: parsed.data.reason || null,
  });
  if (error) return { ok: false, error: "Blokiranje nije uspelo." };

  revalidatePath("/admin/kalendar");
  return { ok: true };
}

export async function deleteBlockedSlot(id: string): Promise<ActionResult> {
  await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
  if (error) return { ok: false, error: "Brisanje nije uspelo." };
  revalidatePath("/admin/kalendar");
  return { ok: true };
}

export async function updateStaffPhoto(
  staffId: string,
  photoUrl: string | null
): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  // Prihvati samo URL iz našeg storage-a, u folderu ovog salona
  if (photoUrl !== null) {
    const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tenant-media/${tenant.id}/`;
    if (!photoUrl.startsWith(expectedPrefix)) {
      return { ok: false, error: "Neispravna adresa slike." };
    }
  }

  const { error } = await supabase
    .from("staff")
    .update({ photo_url: photoUrl })
    .eq("id", staffId);
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  revalidatePath(`/admin/zaposleni/${staffId}`);
  revalidatePath("/admin/zaposleni");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

const appearanceSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Neispravna boja.")
    .optional(),
  fontPair: z.enum(["geist", "elegant", "modern", "warm", "classic"]).optional(),
  mode: z.enum(["light", "dark"]).optional(),
});

export async function updateAppearance(
  input: z.infer<typeof appearanceSchema>
): Promise<ActionResult> {
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.primaryColor) patch.primary_color = parsed.data.primaryColor;

  if (parsed.data.fontPair || parsed.data.mode) {
    const { data: current } = await supabase
      .from("site_settings")
      .select("theme")
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    patch.theme = {
      ...((current?.theme as object) ?? {}),
      ...(parsed.data.fontPair ? { font_pair: parsed.data.fontPair } : {}),
      ...(parsed.data.mode ? { mode: parsed.data.mode } : {}),
    };
  }

  const { error } = await supabase
    .from("site_settings")
    .update(patch)
    .eq("tenant_id", tenant.id);
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  revalidatePath("/admin/podesavanja");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function updateSiteImage(
  kind: "logo" | "hero",
  url: string | null
): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  if (url !== null) {
    const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tenant-media/${tenant.id}/`;
    if (!url.startsWith(expectedPrefix)) {
      return { ok: false, error: "Neispravna adresa slike." };
    }
  }

  const column = kind === "logo" ? "logo_url" : "hero_image_url";
  const { error } = await supabase
    .from("site_settings")
    .update({ [column]: url, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenant.id);
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  revalidatePath("/admin/podesavanja");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function addGalleryImage(url: string): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tenant-media/${tenant.id}/`;
  if (!url.startsWith(expectedPrefix)) {
    return { ok: false, error: "Neispravna adresa slike." };
  }

  const { error } = await supabase
    .from("gallery")
    .insert({ tenant_id: tenant.id, image_url: url });
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  revalidatePath("/admin/galerija");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function deleteGalleryImage(id: string): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("gallery")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("gallery").delete().eq("id", id);
  if (error) return { ok: false, error: "Brisanje nije uspelo." };

  // Počisti i fajl iz storage-a (ako ne uspe, red je već obrisan — nije kritično)
  const path = row?.image_url?.split("/tenant-media/")[1];
  if (path) await supabase.storage.from("tenant-media").remove([path]);

  revalidatePath("/admin/galerija");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function updateBillingInfo(info: string): Promise<ActionResult> {
  const parsed = z.string().trim().max(500).safeParse(info);
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };

  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ billing_note: parsed.data || null })
    .eq("id", tenant.id);
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  revalidatePath("/admin/podesavanja");
  return { ok: true };
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Samoposlužna faktura: kreira (ili ponovo koristi) fakturu za naredni
// period. Numeracija je globalna po godini pa ide preko service-role klijenta;
// članstvo je već potvrđeno kroz getAdminContext.
export async function createInvoice(
  plan: PlanId
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  if (!(plan in PLANS)) return { ok: false, error: "Nepoznat plan." };
  const { tenant } = await getAdminContext();
  const db = createAdminClient();

  // Period počinje danas, ili dan posle postojećeg isteka ako je još plaćen
  const today = new Date().toISOString().slice(0, 10);
  const periodFrom =
    tenant.paid_until && tenant.paid_until >= today
      ? new Date(new Date(`${tenant.paid_until}T12:00:00`).getTime() + 86400000)
          .toISOString()
          .slice(0, 10)
      : today;
  const periodTo = addMonths(periodFrom, PLANS[plan].months);

  // Ako već postoji aktivna faktura za isti plan i period, ne izdaji novu
  // (stornirane se ignorišu — za njih sme nova)
  const { data: existing } = await db
    .from("invoices")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("plan", plan)
    .eq("period_from", periodFrom)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, invoiceId: existing.id };

  const year = new Date().getFullYear();
  const { data: maxRow } = await db
    .from("invoices")
    .select("number")
    .eq("year", year)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextNumber = (maxRow?.number ?? 0) + 1;

  // Retry na sudar numeracije (paralelno izdavanje)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: created, error } = await db
      .from("invoices")
      .insert({
        tenant_id: tenant.id,
        number: nextNumber,
        year,
        plan,
        amount: PLANS[plan].amount,
        period_from: periodFrom,
        period_to: periodTo,
        buyer_info: tenant.billing_note || tenant.name,
      })
      .select("id")
      .single();
    if (!error) {
      revalidatePath("/admin/podesavanja");
      return { ok: true, invoiceId: created.id };
    }
    if (error.code === "23505") {
      nextNumber += 1;
      continue;
    }
    console.error("createInvoice failed:", error);
    return { ok: false, error: "Izdavanje fakture nije uspelo." };
  }
  return { ok: false, error: "Izdavanje fakture nije uspelo. Pokušaj ponovo." };
}

const settingsSchema = z.object({
  heroTitle: z.string().trim().max(100).optional(),
  heroSubtitle: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(200).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  instagram: z.string().trim().max(100).optional(),
  showTeam: z.boolean(),
  showGallery: z.boolean(),
  showPrices: z.boolean(),
});

export async function updateSettings(
  input: z.infer<typeof settingsSchema>
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };

  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({
      hero_title: parsed.data.heroTitle || null,
      hero_subtitle: parsed.data.heroSubtitle || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      instagram: parsed.data.instagram || null,
      show_team: parsed.data.showTeam,
      show_gallery: parsed.data.showGallery,
      show_prices: parsed.data.showPrices,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenant.id);

  if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  revalidatePath("/admin/podesavanja");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function setPublished(published: boolean): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ is_published: published })
    .eq("id", tenant.id);
  if (error) return { ok: false, error: "Izmena nije uspela." };
  revalidatePath("/admin/podesavanja");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}
