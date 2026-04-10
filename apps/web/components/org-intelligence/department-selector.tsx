"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";

interface Department {
  id: string;
  name: string;
  color: string | null;
}

interface DepartmentSelectorProps {
  value: string | null;
  onChange: (id: string | null, name?: string) => void;
}

export function DepartmentSelector({
  value,
  onChange,
}: DepartmentSelectorProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDepartments = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await api.get<Department[]>(
        `/org-intelligence/departments?${params.toString()}`,
      );
      setDepartments(res);
    } catch (err) {
      console.error("Error al cargar departamentos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Debounced search
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const val = event.target.value;
      setInputValue(val);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => {
        fetchDepartments(val || undefined);
      }, 250);
    },
    [fetchDepartments],
  );

  const handleCreateNew = async () => {
    const name = inputValue.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const newDept = await api.post<Department>(
        "/org-intelligence/departments",
        { name },
      );
      setDepartments((prev) => [...prev, newDept].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(newDept.id, newDept.name);
      setInputValue("");
    } catch (err) {
      console.error("Error al crear departamento:", err);
    } finally {
      setCreating(false);
    }
  };

  const selectedDept = departments.find((d) => d.id === value);
  const trimmedInput = inputValue.trim().toLowerCase();
  const exactMatchExists = departments.some(
    (d) => d.name.toLowerCase() === trimmedInput,
  );
  const showCreateOption = trimmedInput.length > 0 && !exactMatchExists;

  return (
    <Combobox
      value={value ?? undefined}
      onValueChange={(newVal) => {
        if (newVal === "__create__") {
          handleCreateNew();
          return;
        }
        const dept = departments.find((d) => d.id === newVal);
        onChange(newVal ? String(newVal) : null, dept?.name);
      }}
    >
      <ComboboxInput
        placeholder={selectedDept?.name || "Seleccionar departamento..."}
        value={inputValue}
        onChange={handleInputChange}
        showClear={!!value}
      />
      <ComboboxContent>
        <ComboboxList>
          {departments.map((dept) => (
            <ComboboxItem key={dept.id} value={dept.id}>
              {dept.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: dept.color }}
                />
              )}
              {dept.name}
            </ComboboxItem>
          ))}
          {showCreateOption && (
            <ComboboxItem value="__create__" className="text-primary">
              <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
              {creating
                ? "Creando..."
                : `Crear "${inputValue.trim()}"`}
            </ComboboxItem>
          )}
          <ComboboxEmpty>
            {loading ? "Buscando..." : "Sin resultados"}
          </ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
