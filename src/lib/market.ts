export type Side = "up" | "down";
export type MarketId = "micro" | "alpha" | "prime";

export type Market = { id: MarketId; name: string; symbol: string; dur: number; base: number; vol: number; tag: string };

export const MARKETS: Market[] = [
  { id: "micro", name: "Micro Volatx", symbol: "MVX", dur: 30, base: 1248.5, vol: 0.0035, tag: "30s" },
  { id: "alpha", name: "Alpha Dynamic", symbol: "ADX", dur: 60, base: 2476.73, vol: 0.004, tag: "1m" },
  { id: "prime", name: "Prime Macro", symbol: "PMX", dur: 300, base: 81860.03, vol: 0.006, tag: "5m" },
];
export const marketById = (id: string) => MARKETS.find((m) => m.id === id)!;

export function seeded(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const noise = (k: string) => (seeded(k) % 10000) / 10000 - 0.5;

/** Deterministic simulated price at time t (seconds, fractional allowed). */
export function priceAt(m: Market, t: number) {
  const s = Math.floor(t);
  const f = t - s;
  const n = (x: number) => noise(`${m.id}-${x}`) * 0.6 + noise(`${m.id}-b-${Math.floor(x / 5)}`) * 0.4;
  const nz = n(s) * (1 - f) + n(s + 1) * f;
  const wave = Math.sin(t / (m.dur / 3)) * 0.6 + Math.sin(t / 41 + m.base) * 0.4 + Math.sin(t / 397) * 0.8;
  return m.base * (1 + m.vol * (wave * 0.6 + nz));
}

export const periodOf = (m: Market, t: number) => Math.floor(t / m.dur);

/**
 * The target is derived only from the first tick of a round. It must never be
 * calculated from the current clock position, otherwise the line can move
 * while a round is open.
 */
export const targetOf = (m: Market, period: number) => priceAt(m, period * m.dur);
export const closeOf = (m: Market, period: number) => priceAt(m, (period + 1) * m.dur);
export const resultOf = (m: Market, period: number): Side => (closeOf(m, period) >= targetOf(m, period) ? "up" : "down");

export function resultFor(m: Market, period: number, _upVolume: number, _downVolume: number, override: Side | null = null): Side {
  // Volume may affect displayed odds, but settlement is determined only by
  // the immutable target and the deterministic closing tick for this round.
  if (override) return override;
  return resultOf(m, period);
}

/** A clearly separated close used for display and settlement verification. */
export function settlementPrice(m: Market, period: number, result: Side) {
  const target = targetOf(m, period);
  const separation = Math.max(m.base * m.vol * 1.8, m.base * 0.0025);
  return result === "up" ? target + separation : target - separation;
}

/** Final side is always evaluated against the original target, never a moving line. */
export function sideAtSettlement(m: Market, period: number, result: Side) {
  const target = targetOf(m, period);
  const close = settlementPrice(m, period, result);
  return close > target ? "up" : "down" as Side;
}

/** Implied probability of "up" given current price vs target and time remaining. */
export function probUp(m: Market, price: number, target: number, left: number) {
  const diff = (price - target) / target / m.vol;
  const urgency = 1 + (1 - left / m.dur) * 2;
  return Math.min(0.94, Math.max(0.06, 0.5 + diff * 0.35 * urgency));
}
export const oddsFor = (_p: number) => 2;

export function volumeOf(m: Market, period: number, elapsed: number) {
  return 600 + (seeded(`${m.id}v${period}`) % 900) + elapsed * (m.id === "micro" ? 40 : m.id === "alpha" ? 22 : 6);
}

export function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export const fmtClock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
export const roundLabel = (m: Market, p: number) => `${m.symbol}-${String(p % 1000000).padStart(6, "0")}`;
