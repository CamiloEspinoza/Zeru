"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface PersonResult {
  id: string;
  name: string;
  role?: string | null;
  email?: string | null;
  user?: { id: string } | null;
}

interface LinkPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onLinked: () => void;
}

export function LinkPersonDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onLinked,
}: LinkPersonDialogProps) {
  const [persons, setPersons] = useState<PersonResult[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");

  const fetchPersons = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        perPage: "20",
      });
      if (searchTerm) params.set("search", searchTerm);

      const res = await api.get<{ data: PersonResult[] }>(
        `/org-intelligence/persons?${params.toString()}`
      );
      setPersons(res.data ?? []);
    } catch {
      setPersons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchPersons("");
    }
  }, [open, fetchPersons]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      fetchPersons(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open, fetchPersons]);

  async function handleSelect(personId: string) {
    setLinking(true);
    setError("");
    try {
      await api.patch(`/users/${userId}/link-person`, {
        personProfileId: personId,
      });
      onOpenChange(false);
      onLinked();
    } catch (err) {
      setError((err as Error).message || "Error al vincular persona");
    } finally {
      setLinking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular persona</DialogTitle>
          <DialogDescription>
            Selecciona el perfil de persona para vincular con{" "}
            <span className="font-medium">{userName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar persona..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Buscando...
              </div>
            ) : (
              <>
                <CommandEmpty>No se encontraron personas</CommandEmpty>
                <CommandGroup>
                  {persons.map((person) => {
                    const isLinkedToOther =
                      person.user && person.user.id !== userId;
                    return (
                      <CommandItem
                        key={person.id}
                        value={person.id}
                        onSelect={() => handleSelect(person.id)}
                        disabled={linking || !!isLinkedToOther}
                        className={
                          isLinkedToOther ? "opacity-50" : ""
                        }
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {person.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {[person.role, person.email]
                              .filter(Boolean)
                              .join(" - ")}
                            {isLinkedToOther && " (vinculada a otro usuario)"}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>

        {error && (
          <p className="text-destructive text-xs px-1">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
