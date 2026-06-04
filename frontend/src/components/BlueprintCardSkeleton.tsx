export function BlueprintCardSkeleton() {
  return (
    <div className="card p-5 space-y-3" aria-hidden>
      <div className="flex justify-between gap-2">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-5 w-14 rounded-full" />
      </div>
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-4/5" />
      <div className="flex justify-between pt-2">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-3 w-12" />
      </div>
    </div>
  );
}
