export const PROPERTY_TYPES = ["House", "Shop", "Apartment", "Plot", "Office", "Other"] as const;
export const REQ_TYPES = ["Buying", "Renting", "Investment", "Commercial"] as const;
export const STATUSES = ["New", "Contacted", "In Progress", "Closed", "Archived"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type ReqType = (typeof REQ_TYPES)[number];
export type Status = (typeof STATUSES)[number];
export type Role = "admin" | "staff";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  is_active: boolean;
}

export interface Lead {
  id: string;
  consultant_id: string;
  consultant_name: string;
  client_name: string;
  transaction_type: "Rent" | "Sale";
  requirement_type: ReqType;
  property_type: PropertyType;
  contact_numbers: string[];
  preferred_locations: string[];
  budget_min: number;
  budget_max: number;
  notes: string;
  custom_attributes: Record<string, string>;
  status: Status;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  lead_id: string;
  changed_by: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}
