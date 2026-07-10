// Ručno pisani tipovi redova iz baze. Kada projekat bude povezan na
// Supabase instancu, mogu se generisati: supabase gen types typescript

export type MemberRole = "owner" | "admin" | "staff";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  is_published: boolean;
  created_at: string;
  trial_ends_at: string;
  paid_until: string | null;
  billing_note: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  // Custom domen salona (null = samo terminer.rs/{slug}); upisuje se
  // isključivo kroz domain-actions posle Vercel sinhronizacije
  custom_domain?: string | null;
}

// Kolone tenants reda dostupne javnim klijentima (kolonske SELECT
// privilegije u bazi) - billing/suspension detalji se čitaju isključivo
// service-role klijentom posle provere članstva.
export type PublicTenant = Pick<
  Tenant,
  "id" | "slug" | "name" | "timezone" | "is_published" | "suspended_at" | "created_at"
>;

export type ButtonStyle = "rounded" | "pill" | "square";

export type RadiusScale = "soft" | "sharp" | "round";
export type BackgroundStyle = "plain" | "tinted";
export type HeadingStyle = "normal" | "caps";

export interface SiteTheme {
  font_pair?: string; // FontPairId
  mode?: "light" | "dark";
  button_style?: ButtonStyle;
  // Novi tokeni (10.7) - svi opcioni, izostanak = današnje ponašanje
  radius_scale?: RadiusScale;
  background?: BackgroundStyle;
  heading_style?: HeadingStyle;
  gradient?: boolean; // false = flat boja umesto brand gradijenta
}

// Stanje vodiča za pokretanje - koraci se izvode iz podataka, čuvaju se
// samo flagovi koji se ne mogu izvesti
export interface OnboardingState {
  welcome_seen?: boolean;
  guide_hidden?: boolean;
  // Radno vreme potvrđeno: ili je vlasnik sačuvao raspored kod zaposlenog,
  // ili je u vodiču kliknuo "Već je tačno" (default 09-20 se ne može
  // razlikovati od "nije ni pogledao", pa se traži eksplicitan signal)
  schedule_confirmed?: boolean;
  // Jednokratno objašnjenje modela "pravilo + izuzeci" na stranici Raspored
  raspored_seen?: boolean;
}

export interface SiteSettings {
  theme?: SiteTheme | null;
  onboarding?: OnboardingState | null;
  tenant_id: string;
  logo_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  primary_color: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  instagram: string | null;
  facebook: string | null;
  show_team: boolean;
  show_gallery: boolean;
  show_prices: boolean;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  // Gornja granica raspona cene; null = fiksna cena (price)
  price_max: number | null;
  currency: string;
  is_active: boolean;
  sort_order: number;
}

export type ScheduleMode = "weekly" | "rotating";

export interface Staff {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  photo_url: string | null;
  bio: string | null;
  is_active: boolean;
  sort_order: number;
  // Pravilo rasporeda: "weekly" = ista nedelja stalno (week_parity 0),
  // "rotating" = smene A/B; rotation_anchor = ponedeljak neke A-nedelje
  schedule_mode: ScheduleMode;
  rotation_anchor: string | null;
  // Koliko dana unapred (računajući danas) gosti vide termine;
  // null = podrazumevano (DEFAULT_HORIZON_DAYS)
  booking_horizon_days: number | null;
}

export interface WorkingHours {
  id: string;
  tenant_id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
  week_parity: number; // 0 = nedelja A (i weekly režim), 1 = nedelja B
}

// Izuzetak za konkretan datum (tabela shift_assignments): gazi pravilo.
// is_off = ne radi; inače start/end_time nose vreme za taj dan.
export interface ScheduleException {
  id: string;
  tenant_id: string;
  staff_id: string;
  date: string;
  is_off: boolean;
  start_time: string | null;
  end_time: string | null;
}

// Rezervacija koja bi posle izmene rasporeda ostala van radnog vremena;
// akcije je vraćaju klijentu da vlasnik odluči (premesti/otkaži/sačuvaj svejedno)
export interface ScheduleConflict {
  staff_name: string;
  date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  service_name: string | null;
}

export type ScheduleActionResult =
  | { ok: true }
  | { ok: false; error?: string; conflicts?: ScheduleConflict[] };

export interface Booking {
  id: string;
  tenant_id: string;
  staff_id: string;
  service_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  date: string;
  start_time: string;
  end_time: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  cancel_token: string;
  note: string | null;
  created_at: string;
  // Samo za rate limit gost-bookinga; upisuje je server akcija
  created_ip?: string | null;
}

export interface Gallery {
  id: string;
  tenant_id: string;
  image_url: string;
  sort_order: number;
}

export interface BlockedSlot {
  id: string;
  tenant_id: string;
  staff_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}
