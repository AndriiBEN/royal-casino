/**
 * Demo currencies. These are display units for the virtual credit balance and labels for
 * simulated deposits. No value here is a market price, and nothing is ever converted into
 * or out of a real asset. The balance itself is always stored in credit cents.
 *
 * Safe to import from client components.
 */

export const CURRENCY_CODES = ["CREDITS", "BTC", "ETH", "USDT"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEPOSIT_CURRENCIES = ["BTC", "ETH", "USDT"] as const;
export type DepositCurrency = (typeof DEPOSIT_CURRENCIES)[number];

type CurrencyInfo = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** decimals shown and stored for the simulated coin amount */
  decimals: number;
  /** fixed demo rate: credit cents per 1 unit. Not linked to any market. */
  centsPerUnit: bigint;
  /** cosmetic network label */
  network: string;
  /** accent colour for the coin glyph */
  accent: string;
};

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  CREDITS: { code: "CREDITS", name: "Royal Credits", symbol: "CR", decimals: 2, centsPerUnit: BigInt(100), network: "Royal Casino", accent: "#D4AF62" },
  BTC: { code: "BTC", name: "Demo Bitcoin", symbol: "₿", decimals: 8, centsPerUnit: BigInt(6_500_000), network: "Demo Bitcoin network", accent: "#F2A33A" },
  ETH: { code: "ETH", name: "Demo Ether", symbol: "Ξ", decimals: 6, centsPerUnit: BigInt(320_000), network: "Demo Ethereum network", accent: "#9AA8FF" },
  USDT: { code: "USDT", name: "Demo Tether", symbol: "₮", decimals: 2, centsPerUnit: BigInt(100), network: "Demo TRC-20 network", accent: "#4FD1A5" },
};

export function isCurrency(v: unknown): v is CurrencyCode {
  return typeof v === "string" && (CURRENCY_CODES as readonly string[]).includes(v);
}

/** Converts credit cents into the demo unit, as a fixed-point decimal string (no float drift). */
export function centsToUnits(cents: number, code: CurrencyCode): string {
  const { decimals, centsPerUnit } = CURRENCIES[code];
  const scale = BigInt(10) ** BigInt(decimals);
  const negative = cents < 0;
  const scaled = (BigInt(Math.abs(Math.trunc(cents))) * scale) / centsPerUnit;
  const whole = scaled / scale;
  const frac = (scaled % scale).toString().padStart(decimals, "0");
  const wholeStr = new Intl.NumberFormat("en-US").format(whole);
  return `${negative ? "-" : ""}${wholeStr}${decimals ? `.${frac}` : ""}`;
}

/** "12,345.67 CR", "0.00189923 BTC" */
export function formatIn(cents: number, code: CurrencyCode) {
  return `${centsToUnits(cents, code)} ${code === "CREDITS" ? "CR" : code}`;
}

/** Human-readable fixed demo rate, e.g. "1 BTC = 65,000 credits" */
export function rateLabel(code: DepositCurrency) {
  const credits = Number(CURRENCIES[code].centsPerUnit) / 100;
  return `1 ${code} = ${new Intl.NumberFormat("en-US").format(credits)} credit${credits === 1 ? "" : "s"}`;
}
