"use client";

// Catches errors in the root layout itself. Must render its own <html>/<body>
// and can't rely on globals.css having loaded — hence inline styles.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-AU">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          margin: 0,
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ color: "#182646" }}>Something went wrong</h1>
          <p style={{ color: "#475569", maxWidth: "28rem" }}>
            Sorry — the page hit an unexpected error. Please try again.
          </p>
          {error.digest && (
            <p style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
              Error reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              minHeight: "44px",
              padding: "0 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#182646",
              color: "#fff",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
