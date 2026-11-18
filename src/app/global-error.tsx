"use client";

/**
 * Last-resort error screen, used only if the root layout itself fails. It replaces the
 * whole document, so it carries its own minimal styling instead of the app's CSS.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0b0d", color: "#f4efe4", fontFamily: "Georgia, serif" }}>
        <main style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <p style={{ color: "#d4af62", letterSpacing: "0.3em", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>ROYAL CASINO</p>
          <h1 style={{ fontSize: 40, fontWeight: 600, margin: "16px 0 8px" }}>The casino didn&apos;t load</h1>
          <p style={{ color: "#a39e93", fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.6 }}>
            Check that the local server is running and the database is set up with <code style={{ color: "#f1d99b" }}>npm run setup</code>, then try again.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 24, padding: "12px 28px", borderRadius: 999, border: 0, background: "linear-gradient(135deg,#f1d99b,#d4af62 45%,#b89550)", color: "#0b0b0d", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
