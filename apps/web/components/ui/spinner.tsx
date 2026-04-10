interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = { sm: "h-3 w-3", md: "h-5 w-5", lg: "h-8 w-8" };
  return (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-current border-t-transparent ${className ?? ""}`}
    />
  );
}
