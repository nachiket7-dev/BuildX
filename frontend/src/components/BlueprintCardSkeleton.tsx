export function BlueprintCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl bg-[#111113]/90 border border-white/[0.08] flex flex-col justify-between h-[240px] animate-pulse" aria-hidden>
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="h-3.5 w-1/3 bg-white/10 rounded" />
          <div className="flex gap-1.5">
            <div className="h-4 w-14 bg-indigo-500/20 rounded-full" />
            <div className="h-4 w-12 bg-white/10 rounded-full" />
          </div>
        </div>
        <div className="h-3 w-full bg-white/5 rounded mb-2" />
        <div className="h-3 w-4/5 bg-white/5 rounded mb-4" />
        <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] mb-3">
          <div className="h-3 bg-white/10 rounded" />
          <div className="h-3 bg-white/10 rounded" />
          <div className="h-3 bg-white/10 rounded" />
        </div>
      </div>
      <div className="pt-3 border-t border-white/[0.06] flex justify-between items-center">
        <div className="h-3 w-16 bg-white/5 rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-white/5 rounded-lg" />
          <div className="h-6 w-16 bg-indigo-500/20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
