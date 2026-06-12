import type { MoveSize } from "@nlr/movepro";

/** Shared between the quote card (client) and the server actions. */
export interface QuoteFlowState {
  step: "start" | "estimated" | "requested";
  /** Form-level error to show the user. */
  error?: string;
  /** Echo of the inputs, carried into the callback step. */
  input?: { size: MoveSize; sizeLabel: string; from: string; to: string };
  estimate?: {
    min: number;
    max: number;
    hours?: number;
    crew?: number;
    truck?: string;
    minimumHours?: number;
    callout?: string;
    deposit?: number;
    mock: boolean;
  };
  /** First name, for the confirmation message. */
  requestedBy?: string;
}

export const MOVE_SIZES: ReadonlyArray<{ value: MoveSize; label: string }> = [
  { value: "few-items", label: "A few items" },
  { value: "studio", label: "Studio" },
  { value: "1-bedroom", label: "1 bedroom" },
  { value: "2-bedroom", label: "2 bedrooms" },
  { value: "3-bedroom", label: "3 bedrooms" },
  { value: "4-bedroom-plus", label: "4+ bedrooms" },
  { value: "office", label: "Office" },
];
