export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.8
      ? "text-green-700 bg-green-100"
      : confidence >= 0.5
        ? "text-amber-700 bg-amber-100"
        : "text-red-700 bg-red-100";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {pct}%
    </span>
  );
}
