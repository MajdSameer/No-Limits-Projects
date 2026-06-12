"use server";

import { createMoveproClient, type MoveproClient } from "@nlr/movepro";

import { MOVE_SIZES, type QuoteFlowState } from "./quote-options";

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function buildEstimate(
  movepro: MoveproClient,
  size: (typeof MOVE_SIZES)[number],
  from: string,
  to: string,
): Promise<NonNullable<QuoteFlowState["estimate"]>> {
  const quote = await movepro.requestQuote({
    size: size.value,
    from: { suburb: from, state: "NSW", postcode: "" },
    to: { suburb: to, state: "NSW", postcode: "" },
  });
  return {
    min: quote.priceRange.min,
    max: quote.priceRange.max,
    hours: quote.estimatedHours,
    crew: quote.crewSize,
    truck: quote.truckSize,
    minimumHours: quote.minimumHours,
    callout: quote.callout,
    deposit: quote.depositAmount,
    mock: movepro.mode === "mock",
  };
}

/**
 * One action, two intents (hidden "intent" field):
 *   "estimate" — price the move via the Movepro adapter
 *   "callback" — create a lead in the CRM for a callback
 * The move details travel in form fields (hidden ones on the callback form),
 * so the flow never depends on stale React state.
 */
export async function quoteFlow(
  _prev: QuoteFlowState,
  formData: FormData,
): Promise<QuoteFlowState> {
  const intent = field(formData, "intent");
  const size = MOVE_SIZES.find((s) => s.value === formData.get("size"));
  const from = field(formData, "from");
  const to = field(formData, "to");

  if (!size || !from || !to) {
    return {
      step: "start",
      error: "Fill in the move size and both suburbs to get your estimate.",
    };
  }

  const movepro = createMoveproClient();
  const input = { size: size.value, sizeLabel: size.label, from, to };
  const estimate = await buildEstimate(movepro, size, from, to);

  if (intent !== "callback") {
    return { step: "estimated", input, estimate };
  }

  const name = field(formData, "name");
  const phone = field(formData, "phone");
  if (!name || phone.replace(/\D/g, "").length < 8) {
    return {
      step: "estimated",
      input,
      estimate,
      error: "Add your name and a phone number we can reach you on.",
    };
  }

  await movepro.createLead({
    contact: { firstName: name, phone },
    from: { suburb: from, state: "NSW", postcode: "" },
    to: { suburb: to, state: "NSW", postcode: "" },
    size: size.value,
    source: "template-quote-card",
  });

  return { step: "requested", input, estimate, requestedBy: name };
}
