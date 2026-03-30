"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  text: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  iconSize?: "sm" | "md";
}

export function HelpTooltip({
  text,
  className,
  side = "top",
  iconSize = "sm",
}: HelpTooltipProps) {
  const size = iconSize === "sm" ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex cursor-help items-center justify-center rounded-full border border-muted-foreground/30 text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:text-foreground",
              size,
              className,
            )}
            tabIndex={0}
          >
            ?
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-left">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface SectionHelpProps {
  title: string;
  description: string;
  className?: string;
}

export function SectionHelp({ title, description, className }: SectionHelpProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <HelpTooltip text={description} />
    </div>
  );
}
