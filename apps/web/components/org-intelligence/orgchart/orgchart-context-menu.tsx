"use client";

import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Edit02Icon,
  Delete02Icon,
  Add01Icon,
  EyeIcon,
  UserGroupIcon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons";
import type { ContextMenuState } from "./types";

interface OrgChartContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onHighlightChain: (nodeId: string) => void;
  onAddReport: (reportsToId: string) => void;
  onUnlink: (personId: string) => void;
  onDelete: (personId: string) => void;
  onEdit: (personId: string) => void;
}

export function OrgChartContextMenu({
  menu,
  onClose,
  onHighlightChain,
  onAddReport,
  onUnlink,
  onDelete,
  onEdit,
}: OrgChartContextMenuProps) {
  const router = useRouter();

  if (!menu.visible) return null;

  const handleAction = (callback: () => void) => {
    callback();
    onClose();
  };

  // Smart positioning: flip if near edges
  const menuWidth = 220;
  const menuHeight = 280;
  const x =
    menu.x + menuWidth > window.innerWidth ? menu.x - menuWidth : menu.x;
  const y =
    menu.y + menuHeight > window.innerHeight ? menu.y - menuHeight : menu.y;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onPointerDown={onClose}
        aria-hidden="true"
      />

      {/* Menu */}
      <div
        className="fixed z-50 min-w-[220px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
        style={{ left: x, top: y }}
        role="menu"
      >
        {/* Ver perfil */}
        <button
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
          role="menuitem"
          onClick={() =>
            handleAction(() =>
              router.push(`/personas/directorio?id=${menu.nodeId}`),
            )
          }
        >
          <HugeiconsIcon icon={EyeIcon} size={16} className="text-muted-foreground" />
          <span>Ver perfil</span>
        </button>

        {/* Editar cargo */}
        <button
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
          role="menuitem"
          onClick={() => handleAction(() => onEdit(menu.nodeId))}
        >
          <HugeiconsIcon icon={Edit02Icon} size={16} className="text-muted-foreground" />
          <span>Editar cargo</span>
        </button>

        {/* Ver cadena de mando */}
        <button
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
          role="menuitem"
          onClick={() => handleAction(() => onHighlightChain(menu.nodeId))}
        >
          <HugeiconsIcon icon={UserGroupIcon} size={16} className="text-muted-foreground" />
          <span>Ver cadena de mando</span>
        </button>

        <div className="my-1 border-t border-border" role="separator" />

        {/* Agregar reporte directo */}
        <button
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
          role="menuitem"
          onClick={() => handleAction(() => onAddReport(menu.nodeId))}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} className="text-muted-foreground" />
          <span>Agregar reporte directo</span>
        </button>

        <div className="my-1 border-t border-border" role="separator" />

        {/* Desvincular del organigrama */}
        <button
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
          role="menuitem"
          onClick={() => handleAction(() => onUnlink(menu.nodeId))}
        >
          <HugeiconsIcon icon={Unlink01Icon} size={16} className="text-muted-foreground" />
          <span>Desvincular del organigrama</span>
        </button>

        {/* Eliminar persona */}
        <button
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          role="menuitem"
          onClick={() => handleAction(() => onDelete(menu.nodeId))}
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} />
          <span>Eliminar persona</span>
        </button>
      </div>
    </>
  );
}
