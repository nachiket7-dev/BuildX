export function BlueprintLoadingSkeleton() {
  return (
    <section
      className="flex-1 px-4 sm:px-6 py-12 max-w-5xl mx-auto w-full"
      aria-busy="true"
      aria-label="Loading blueprint"
    >
      <div className="skeleton h-10 w-2/3 max-w-md mb-4 rounded-lg" />
      <div className="skeleton h-4 w-full max-w-2xl mb-2 rounded" />
      <div className="skeleton h-4 w-4/5 max-w-xl mb-8 rounded" />
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-7 w-24 rounded-full" />
        ))}
      </div>
      <div className="flex gap-2 mb-6 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-20 rounded-lg flex-shrink-0" />
        ))}
      </div>
      <div className="card p-6 space-y-4">
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton h-32 w-full rounded-lg" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </section>
  );
}
