export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="skeleton h-8 w-60" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24" />)}</div>
      <div className="skeleton h-72" />
    </div>
  );
}
