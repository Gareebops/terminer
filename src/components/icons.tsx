// Centralni set ikonica aplikacije (Phosphor umesto lucide - Mihajlova
// odluka 11.7: lucide je delovao generički). Pravila:
// - "duotone" za semantičke/feature ikonice (nav, prazna stanja, kartice) -
//   dvotonski sloj (20% ispuna iste boje) daje karakter na ink/mint/lavandi;
// - "bold" za sitne glifove (strelice, karet, x, check, spinner) - duotone
//   je na 14-16px mutan, bold ostaje čitak.
// UVEK uvoziti odavde, ne direktno iz @phosphor-icons/react - jedna tačka
// za promenu karaktera celog seta. dist/ssr varijanta je bez React context-a
// pa radi i u server i u client komponentama. Semantički izbori: Rezervacije
// = Ticket (rimuje se sa "ulaznicom" na ekranu uspeha), Objavi = RocketLaunch,
// Podešavanja = Sliders (podešavanje izgleda, ne mašinski zupčanik),
// Raspored = ClockUser (ko kad radi).
import type { Icon, IconProps } from "@phosphor-icons/react";
import * as Ph from "@phosphor-icons/react/dist/ssr";

function withWeight(Base: Icon, weight: IconProps["weight"]) {
  function Configured(props: IconProps) {
    return <Base weight={weight} {...props} />;
  }
  Configured.displayName = Base.displayName ?? "Icon";
  return Configured;
}

// --- Semantičke ikonice (duotone) ---
export const At = withWeight(Ph.At, "duotone");
export const CalendarCheck = withWeight(Ph.CalendarCheck, "duotone");
export const CalendarDots = withWeight(Ph.CalendarDots, "duotone");
export const CalendarPlus = withWeight(Ph.CalendarPlus, "duotone");
export const CalendarSlash = withWeight(Ph.CalendarSlash, "duotone");
export const CalendarX = withWeight(Ph.CalendarX, "duotone");
export const Clock = withWeight(Ph.Clock, "duotone");
export const ClockAfternoon = withWeight(Ph.ClockAfternoon, "duotone");
export const ClockUser = withWeight(Ph.ClockUser, "duotone");
export const CreditCard = withWeight(Ph.CreditCard, "duotone");
export const EnvelopeOpen = withWeight(Ph.EnvelopeOpen, "duotone");
export const Eye = withWeight(Ph.Eye, "duotone");
export const EyeSlash = withWeight(Ph.EyeSlash, "duotone");
export const Globe = withWeight(Ph.Globe, "duotone");
export const House = withWeight(Ph.House, "duotone");
export const Images = withWeight(Ph.Images, "duotone");
export const MapPin = withWeight(Ph.MapPin, "duotone");
export const PencilSimple = withWeight(Ph.PencilSimple, "duotone");
export const Phone = withWeight(Ph.Phone, "duotone");
export const Printer = withWeight(Ph.Printer, "duotone");
export const Prohibit = withWeight(Ph.Prohibit, "duotone");
export const RocketLaunch = withWeight(Ph.RocketLaunch, "duotone");
export const Scissors = withWeight(Ph.Scissors, "duotone");
export const ShareNetwork = withWeight(Ph.ShareNetwork, "duotone");
export const SignOut = withWeight(Ph.SignOut, "duotone");
export const Sliders = withWeight(Ph.Sliders, "duotone");
export const Sparkle = withWeight(Ph.Sparkle, "duotone");
export const Ticket = withWeight(Ph.Ticket, "duotone");
export const Trash = withWeight(Ph.Trash, "duotone");
export const UsersThree = withWeight(Ph.UsersThree, "duotone");
export const Warning = withWeight(Ph.Warning, "duotone");

// --- Sitni glifovi (bold) ---
export const ArrowDown = withWeight(Ph.ArrowDown, "bold");
export const ArrowLeft = withWeight(Ph.ArrowLeft, "bold");
export const ArrowRight = withWeight(Ph.ArrowRight, "bold");
export const ArrowSquareOut = withWeight(Ph.ArrowSquareOut, "bold");
export const ArrowUp = withWeight(Ph.ArrowUp, "bold");
export const ArrowUpRight = withWeight(Ph.ArrowUpRight, "bold");
export const ArrowsClockwise = withWeight(Ph.ArrowsClockwise, "bold");
export const CaretDown = withWeight(Ph.CaretDown, "bold");
export const CaretLeft = withWeight(Ph.CaretLeft, "bold");
export const CaretRight = withWeight(Ph.CaretRight, "bold");
export const Check = withWeight(Ph.Check, "bold");
export const CircleNotch = withWeight(Ph.CircleNotch, "bold");
export const Copy = withWeight(Ph.Copy, "bold");
export const List = withWeight(Ph.List, "bold");
export const MagnifyingGlass = withWeight(Ph.MagnifyingGlass, "bold");
export const Plus = withWeight(Ph.Plus, "bold");
export const UploadSimple = withWeight(Ph.UploadSimple, "bold");
export const X = withWeight(Ph.X, "bold");
