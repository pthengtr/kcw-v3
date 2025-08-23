// Shared enums & row types

export const PARTY_KINDS = ["CUSTOMER", "SUPPLIER", "BOTH"] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

export type Party = {
  party_uuid: string;
  party_code: string | null;
  party_name: string;
  kind: PartyKind | string; // tolerate unexpected enum values from DB
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Bank account type (adjust to your public.bank_account_type)
export const BANK_ACCOUNT_TYPES = ["SAVINGS", "CURRENT", "OTHER"] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

// Child tables (shape mirrors your schema)
export type ContactRow = {
  contact_uuid: string;
  party_uuid: string;
  contact_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type BankInfoRow = {
  bank_info_uuid: string;
  party_uuid: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string | null;
  account_type: BankAccountType | string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type TaxInfoRow = {
  tax_info_uuid: string;
  party_uuid: string;
  legal_name: string | null;
  tax_payer_id: string | null;
  address: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at: string;
};

// Type guards
export function isPartyKind(x: unknown): x is PartyKind {
  return (
    typeof x === "string" && (PARTY_KINDS as readonly string[]).includes(x)
  );
}
export function isBankType(x: unknown): x is BankAccountType {
  return (
    typeof x === "string" &&
    (BANK_ACCOUNT_TYPES as readonly string[]).includes(x)
  );
}
