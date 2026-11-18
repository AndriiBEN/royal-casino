import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the Royal Casino crown on black, rendered to PNG at build time. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 35%, #2a2416, #0b0b0d 70%)" }}>
        <svg width="132" height="132" viewBox="0 0 48 48">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F6E2A8" />
              <stop offset="0.45" stopColor="#D4AF62" />
              <stop offset="1" stopColor="#8A6A2F" />
            </linearGradient>
          </defs>
          <path d="M15 1h18l14 14v18L33 47H15L1 33V15z" fill="#0B0B0D" stroke="url(#g)" strokeWidth="2" />
          <path d="M12.5 32 11 17l6.8 5.8L24 12.5l6.2 10.3L37 17l-1.5 15z" fill="url(#g)" />
          <rect x="12.5" y="34" width="23" height="3.4" rx="1.2" fill="url(#g)" />
        </svg>
      </div>
    ),
    size,
  );
}
