import { MoveproConfigError, type MoveproClient } from "./client";
import { LiveMoveproClient } from "./live";
import { MockMoveproClient } from "./mock";

export type { MoveproClient } from "./client";
export { MoveproConfigError } from "./client";
export { MockMoveproClient } from "./mock";
export { LiveMoveproClient } from "./live";
export type * from "./types";

export interface MoveproClientOptions {
  /** Defaults to MOVEPRO_MODE env var, falling back to "mock". */
  mode?: "mock" | "live";
  /** Defaults to MOVEPRO_API_KEY env var. Required in live mode. */
  apiKey?: string;
  /** Defaults to MOVEPRO_BASE_URL env var. */
  baseUrl?: string;
}

/**
 * The one way apps get a Movepro client. Mock by default — live mode only
 * activates when explicitly requested AND credentials exist, so nothing
 * breaks while API access is unconfirmed.
 *
 *   const movepro = createMoveproClient();
 *   const estimate = await movepro.requestQuote({ ... });
 */
export function createMoveproClient(options: MoveproClientOptions = {}): MoveproClient {
  const mode = options.mode ?? (process.env.MOVEPRO_MODE === "live" ? "live" : "mock");

  if (mode === "live") {
    const apiKey = options.apiKey ?? process.env.MOVEPRO_API_KEY;
    if (!apiKey) {
      throw new MoveproConfigError(
        "MOVEPRO_MODE is 'live' but no API key was provided. Set MOVEPRO_API_KEY, or remove MOVEPRO_MODE to use the mock.",
      );
    }
    return new LiveMoveproClient({
      apiKey,
      baseUrl:
        options.baseUrl ?? process.env.MOVEPRO_BASE_URL ?? "https://api.movepro.example",
    });
  }

  return new MockMoveproClient();
}
