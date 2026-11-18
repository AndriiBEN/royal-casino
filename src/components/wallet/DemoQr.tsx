import "server-only";
import QRCode from "qrcode";

/**
 * QR code for a demo deposit. It encodes a plain-text warning, NOT a payment URI
 * (no bitcoin:/ethereum: scheme), so scanning it in a wallet app cannot start a payment.
 * The DEMO ONLY overlay sits on the code's centre, which error correction level H tolerates.
 * Rendered on the server, so the QR library never ships to the browser.
 */
export function DemoQr({ payload, label }: { payload: string; label: string }) {
  const { rows, dim } = (() => {
    const qr = QRCode.create(payload, { errorCorrectionLevel: "H" });
    const size = qr.modules.size;
    const quiet = 2;
    const out: string[] = [];
    for (let y = 0; y < size; y++) {
      let d = "";
      for (let x = 0; x < size; x++) {
        if (!qr.modules.get(y, x)) continue;
        let run = 1;
        while (x + run < size && qr.modules.get(y, x + run)) run++;
        d += `M${x + quiet} ${y + quiet}h${run}v1h-${run}z`;
        x += run - 1;
      }
      if (d) out.push(d);
    }
    return { rows: out, dim: size + quiet * 2 };
  })();

  const band = Math.round(dim * 0.22);

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${dim} ${dim}`}
        role="img"
        aria-label={`QR code for ${label}. Demo only, not a payment address.`}
        className="block h-auto w-full rounded-xl"
        shapeRendering="crispEdges"
      >
        <rect width={dim} height={dim} fill="#F7F1E3" />
        <g fill="#0B0B0D">
          {rows.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <rect x={dim * 0.14} y={(dim - band) / 2} width={dim * 0.72} height={band} rx={1.2} fill="#0B0B0D" />
        <rect
          x={dim * 0.14 + 0.6}
          y={(dim - band) / 2 + 0.6}
          width={dim * 0.72 - 1.2}
          height={band - 1.2}
          rx={0.8}
          fill="none"
          stroke="#D4AF62"
          strokeWidth={0.4}
        />
        <text
          x={dim / 2}
          y={dim / 2 + band * 0.17}
          textAnchor="middle"
          fill="#D4AF62"
          fontFamily="Manrope, system-ui, sans-serif"
          fontWeight={800}
          fontSize={band * 0.42}
          letterSpacing={band * 0.03}
        >
          DEMO ONLY
        </text>
      </svg>
      <figcaption className="mt-2 text-center text-[0.62rem] font-bold uppercase tracking-[0.2em] text-gold">
        Demo only · do not send real funds
      </figcaption>
    </figure>
  );
}
