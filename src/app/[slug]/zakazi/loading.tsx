import { Skeleton } from "@/components/ui/skeleton";

// Skeleton dok se wizard sprema: klik "Zakaži termin" sa sajta salona
// odmah daje odgovor umesto zamrznute stranice. Renderuje se unutar
// [slug]/layout-a pa boje prate temu salona.
export default function BookingLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-9 w-56" />
      <div className="mt-8 flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <Skeleton className="hidden h-3 w-12 sm:block" />
            {i < 3 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </main>
  );
}
