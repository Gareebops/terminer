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
}

export type ButtonStyle = "rounded" | "pill" | "square";

export interface SiteTheme {
  font_pair?: string; // FontPairId
  mode?: "light" | "dark";
  button_style?: ButtonStyle;
}

export interface SiteSettings {
  theme?: SiteTheme | null;
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
  currency: string;
  is_active: boolean;
  sort_order: number;
}

export interface Staff {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  photo_url: string | null;
  bio: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface WorkingHours {
  id: string;
  tenant_id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
}

export interface ShiftTemplate {
  id: string;
  tenant_id: string;
  staff_id: string;
  name: string;
  start_time: string;
  end_time: string;
  color: string | null;
  sort_order: number;
}

export interface ShiftAssignment {
  id: string;
  tenant_id: string;
  staff_id: string;
  date: string;
  shift_template_id: string | null;
  is_off: boolean;
}

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
