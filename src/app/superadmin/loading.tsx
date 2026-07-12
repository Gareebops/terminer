import { Skeleton } from "@/components/ui/skeleton";

// Trenutni skeleton dok se superadmin panel renderuje (dosta upita: saloni,
// fakture, aktivnost, prisustvo). Generički raspored: naslov, red stat
// kartica, lista salona.
export default function SuperadminLoading() {
  return (
    <main className="min-h-screen flex-1 bg-canvas p-6 font-display text-ink">
      <div className="mx-auto max-w-5xl">
        <Skeleton className="h-9 w-48 rounded-full" />
        <Skeleton className="mt-2 h-4 w-72 rounded-full" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
