/**
 * Booking types/constants shared by client components and the server core.
 * MUST stay dependency-free — anything imported here ships to the browser.
 */

export const BOOKING_TYPES = ["moving", "storage", "cleaning", "car"] as const;
export type BookingTypeInput = (typeof BOOKING_TYPES)[number];

export interface QuickAddInput {
  jobNumber: string;
  type: BookingTypeInput;
  moveDate: string; // yyyy-MM-dd
  customerName?: string;
  customerPhone?: string;
  pickup?: string;
  delivery?: string;
  value?: string;
  deposit?: string;
}

export type CreateResult =
  | { ok: true; id: string; jobNumber: string }
  | { ok: false; error: "duplicate"; existingId: string; byName: string; atISO: string }
  | { ok: false; error: "invalid"; message: string };

export const EDITABLE_FIELDS = [
  "customerName",
  "customerPhone",
  "customerEmail",
  "pickup",
  "delivery",
  "state",
  "moveDate",
  "value",
  "deposit",
  "beds",
  "cubic",
  "men",
  "leadSource",
  "notes",
  "type",
  "status",
  "company",
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

export type UpdateResult =
  | { ok: true; diff: Record<string, { from: unknown; to: unknown }> }
  | { ok: false; error: "not-found" | "forbidden" | "invalid" };
