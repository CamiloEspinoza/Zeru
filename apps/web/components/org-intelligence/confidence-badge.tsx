export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.8
      ? "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900"
      : confidence >= 0.5
        ? "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900"
        : "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {pct}%
    </span>
  );
}
