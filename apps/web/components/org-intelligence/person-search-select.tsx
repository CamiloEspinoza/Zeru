"use client";

import React, { useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";

interface DirectoryPerson {
  id: string;
  name: string;
  role: string | null;
  department: { id: string; name: string } | null;
  avatarS3Key: string | null;
}

interface PersonSearchSelectProps {
  onSelect: (person: {
    id: string;
    name: string;
    role?: string;
    department?: string;
    avatarS3Key?: string;
  }) => void;
  placeholder?: string;
}

export function PersonSearchSelect({
  onSelect,
  placeholder = "Buscar en directorio...",
}: PersonSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryPerson[]>([]);
  const [open, setOpen] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceTimer) clearTimeout(debounceTimer);

      if (value.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }

      const timer = setTimeout(async () => {
        try {
          const res = await api.get<{ data: DirectoryPerson[] }>(
            `/org-intelligence/persons?search=${encodeURIComponent(value)}`,
          );
          const data = res.data ?? [];
          setResults(data);
          setOpen(true);
        } catch {
          setResults([]);
        }
      }, 300);

      setDebounceTimer(timer);
    },
    [debounceTimer],
  );

  const handleSelect = (person: DirectoryPerson) => {
    onSelect({
      id: person.id,
      name: person.name,
      role: person.role ?? undefined,
      department:
        typeof person.department === "object" && person.department !== null
          ? person.department.name
          : undefined,
      avatarS3Key: person.avatarS3Key ?? undefined,
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder={placeholder}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No se encontraron personas
            </p>
          ) : (
            results.map((person) => (
              <button
                key={person.id}
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={() => handleSelect(person)}
              >
                <span className="font-medium">{person.name}</span>
                {(person.role || person.department) && (
                  <span className="text-xs text-muted-foreground">
                    {[person.role, person.department?.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
