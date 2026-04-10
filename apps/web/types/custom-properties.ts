import type { UserSummary } from "./projects";

export type PropertyType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "MULTI_SELECT"
  | "DATE"
  | "PERSON"
  | "CHECKBOX"
  | "URL";

export interface PropertyOption {
  id: string;
  label: string;
  color: string;
}

export interface ProjectPropertyDefinition {
  id: string;
  name: string;
  type: PropertyType;
  options: PropertyOption[] | null;
  sortOrder: number;
  isRequired: boolean;
  isVisible: boolean;
  isFilterable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPropertyValue {
  id: string;
  propertyDefinitionId: string;
  textValue: string | null;
  numberValue: number | null;
  dateValue: string | null;
  booleanValue: boolean | null;
  selectedOptionIds: string[];
  personUserId: string | null;
  personUser: UserSummary | null;
  updatedAt: string;
}

export interface CreatePropertyDefinitionPayload {
  name: string;
  type: PropertyType;
  options?: PropertyOption[];
  sortOrder?: number;
  isRequired?: boolean;
  isVisible?: boolean;
  isFilterable?: boolean;
}

export interface UpdatePropertyDefinitionPayload {
  name?: string;
  options?: PropertyOption[] | null;
  isRequired?: boolean;
  isVisible?: boolean;
  isFilterable?: boolean;
}

export interface SetPropertyValuePayload {
  textValue?: string | null;
  numberValue?: number | null;
  dateValue?: string | null;
  booleanValue?: boolean | null;
  selectedOptionIds?: string[];
  personUserId?: string | null;
}
