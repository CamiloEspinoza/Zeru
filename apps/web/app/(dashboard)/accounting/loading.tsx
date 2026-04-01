export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="space-y-4 w-full max-w-md">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
