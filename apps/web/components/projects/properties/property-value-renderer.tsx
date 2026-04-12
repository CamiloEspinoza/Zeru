"use client";

import type {
  ProjectPropertyDefinition,
  TaskPropertyValue,
  SetPropertyValuePayload,
} from "@/types/custom-properties";
import type { ProjectMember } from "@/types/projects";
import { getUserAvatarUrl } from "@/lib/avatar-url";
import { PropertyTextEditor } from "./property-text-editor";
import { PropertyNumberEditor } from "./property-number-editor";
import { PropertySelectEditor } from "./property-select-editor";
import { PropertyMultiSelectEditor } from "./property-multi-select-editor";
import { PropertyDateEditor } from "./property-date-editor";
import { PropertyPersonEditor } from "./property-person-editor";
import { PropertyCheckboxEditor } from "./property-checkbox-editor";
import { PropertyUrlEditor } from "./property-url-editor";

interface PropertyValueRendererProps {
  definition: ProjectPropertyDefinition;
  value: TaskPropertyValue | null;
  members: ProjectMember[];
  onSave: (payload: SetPropertyValuePayload) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function PropertyValueRenderer({
  definition,
  value,
  members,
  onSave,
  onClear,
  disabled = false,
}: PropertyValueRendererProps) {
  switch (definition.type) {
    case "TEXT":
      return (
        <PropertyTextEditor
          value={value?.textValue ?? null}
          onChange={(v) =>
            v !== null ? onSave({ textValue: v }) : onClear()
          }
          disabled={disabled}
        />
      );

    case "NUMBER":
      return (
        <PropertyNumberEditor
          value={value?.numberValue ?? null}
          onChange={(v) =>
            v !== null ? onSave({ numberValue: v }) : onClear()
          }
          disabled={disabled}
        />
      );

    case "SELECT":
      return (
        <PropertySelectEditor
          value={value?.selectedOptionIds ?? []}
          options={definition.options ?? []}
          onChange={(ids) => onSave({ selectedOptionIds: ids })}
          onClear={onClear}
          disabled={disabled}
        />
      );

    case "MULTI_SELECT":
      return (
        <PropertyMultiSelectEditor
          value={value?.selectedOptionIds ?? []}
          options={definition.options ?? []}
          onChange={(ids) => onSave({ selectedOptionIds: ids })}
          onClear={onClear}
          disabled={disabled}
        />
      );

    case "DATE":
      return (
        <PropertyDateEditor
          value={value?.dateValue ?? null}
          onChange={(v) =>
            v !== null ? onSave({ dateValue: v }) : onClear()
          }
          disabled={disabled}
        />
      );

    case "PERSON": {
      const personUser = value?.personUser;
      return (
        <PropertyPersonEditor
          value={value?.personUserId ?? null}
          personName={
            personUser
              ? `${personUser.firstName} ${personUser.lastName}`
              : null
          }
          personAvatarUrl={getUserAvatarUrl(personUser?.id) ?? null}
          members={members}
          onChange={(userId) =>
            userId !== null ? onSave({ personUserId: userId }) : onClear()
          }
          disabled={disabled}
        />
      );
    }

    case "CHECKBOX":
      return (
        <PropertyCheckboxEditor
          value={value?.booleanValue ?? null}
          onChange={(v) => onSave({ booleanValue: v })}
          disabled={disabled}
        />
      );

    case "URL":
      return (
        <PropertyUrlEditor
          value={value?.textValue ?? null}
          onChange={(v) =>
            v !== null ? onSave({ textValue: v }) : onClear()
          }
          disabled={disabled}
        />
      );

    default:
      return (
        <span className="text-xs text-muted-foreground">
          Tipo no soportado
        </span>
      );
  }
}
