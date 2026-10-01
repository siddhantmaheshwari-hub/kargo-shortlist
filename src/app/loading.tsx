// Shown instantly on navigation while the page's data loads, so the app never feels stuck.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-4 w-40 rounded-full bg-line" />
        <div className="h-9 w-72 rounded-full bg-line" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card h-56" />
        <div className="card h-56" />
      </div>
      <div className="card h-40" />
    </div>
  );
}
