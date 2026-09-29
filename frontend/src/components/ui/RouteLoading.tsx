import { Logo } from "../Logo";

export function RouteLoading({ label = "Opening BuildX" }: { label?: string }) {
  return (
    <div className="route-loading" role="status">
      <Logo size="lg" />
      <p>{label}…</p>
    </div>
  );
}
