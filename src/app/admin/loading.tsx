import { Skeleton } from "@/components/ui/skeleton";

// Trenutni feedback pri navigaciji kroz admin: prikazuje se ODMAH po
// kliku, dok server renderuje stranicu (Suspense granica za sve /admin
// rute). Generički raspored koji liči na većinu admin ekrana.
export default function AdminLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-44 rounded-full" />
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-80 rounded-[2rem]" />
        <div className="grid gap-4">
          <Skeleton className="h-36 rounded-[2rem]" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-36 rounded-[2rem]" />
            <Skeleton className="h-36 rounded-[2rem]" />
          </div>
        </div>
      </div>
    </div>
  );
}
