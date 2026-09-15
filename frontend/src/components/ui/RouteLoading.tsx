export function RouteLoading({ label = "Opening BuildX" }: { label?: string }) {
  return (
    <div className="route-loading" role="status">
      <div className="route-wordmark" aria-hidden="true">
        Build<span>X</span>
      </div>
      <div className="entrance-line" aria-hidden="true">
        <i />
      </div>
      <p>{label}…</p>
    </div>
  );
}
