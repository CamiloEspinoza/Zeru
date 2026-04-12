"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { ProjectMember } from "@/types/projects";
import { getUserAvatarUrl } from "@/lib/avatar-url";

function initials(firstName: string, lastName: string): string {
  return (
    ((firstName?.charAt(0) ?? "") + (lastName?.charAt(0) ?? "")).toUpperCase() ||
    "?"
  );
}

interface PropertyPersonEditorProps {
  value: string | null;
  personName: string | null;
  personAvatarUrl: string | null;
  members: ProjectMember[];
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PropertyPersonEditor({
  value,
  personName,
  personAvatarUrl,
  members,
  onChange,
  placeholder = "Asignar persona...",
  disabled = false,
}: PropertyPersonEditorProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (userId: string) => {
    if (userId === value) {
      onChange(null);
    } else {
      onChange(userId);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-7 w-full justify-start px-2 text-xs font-normal",
            !value && "text-muted-foreground",
          )}
        >
          {value && personName ? (
            <span className="flex items-center gap-1.5">
              <Avatar className="size-4">
                {personAvatarUrl && (
                  <AvatarImage src={personAvatarUrl} alt={personName} />
                )}
                <AvatarFallback className="text-[6px]">
                  {initials(
                    personName.split(" ")[0] ?? "",
                    personName.split(" ")[1] ?? "",
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{personName}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <HugeiconsIcon
                icon={UserIcon}
                strokeWidth={2}
                className="size-3.5"
              />
              {placeholder}
            </span>
          )}
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                className="size-3"
              />
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar miembro..." />
          <CommandList>
            <CommandEmpty>Sin miembros</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem
                  key={member.userId}
                  value={`${member.user.firstName} ${member.user.lastName}`}
                  onSelect={() => handleSelect(member.userId)}
                  data-checked={member.userId === value || undefined}
                >
                  <Avatar className="size-4 shrink-0">
                    {member.userId && (
                      <AvatarImage
                        src={getUserAvatarUrl(member.userId)!}
                        alt={`${member.user.firstName} ${member.user.lastName}`}
                      />
                    )}
                    <AvatarFallback className="text-[6px]">
                      {initials(member.user.firstName, member.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">
                    {member.user.firstName} {member.user.lastName}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
