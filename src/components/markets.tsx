import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Activity, Zap, Gauge, Mountain, TrendingUp, TrendingDown } from "lucide-react";
import { useStore, money } from "@/lib/store";
import { placeSharedBet } from "@/lib/supabase";
import { BottomSheet, btnPrimary, inputCls } from "./Sheet";
import { fmtClock, fmtPrice, oddsFor, periodOf, priceAt, probUp, resultFor, roundLabel, targetOf, volumeOf, MARKETS, type Market, type Side } from "@/lib/market";

export function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() / 1000), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export const marketIcon = { micro: Zap, alpha: Gauge, prime: Mountain } as const;

export function useMarketState(m: Market, now: number) {
  const period = periodOf(m, now);
  const elapsed = now - period * m.dur;
  const left = Math.max(0, Math.ceil(m.dur - elapsed));
  const target = targetOf(m, period);
  const price = priceAt(m, now);
  const pUpBase = probUp(m, price, target, left);
  const { bets, marketOverride } = useStore();
  const positions = bets.filter((b) => b.kind === m.id && b.dur === m.dur && b.period === period);
  const upVolume = positions.filter((b) => b.sel === "up").reduce((sum, b) => sum + b.amount, 0);
  const downVolume = positions.filter((b) => b.sel === "down").reduce((sum, b) => sum + b.amount, 0);
  const autoBias = upVolume === downVolume ? pUpBase : upVolume > downVolume ? Math.min(pUpBase, 0.28) : Math.max(pUpBase, 0.72);
  const pUp = marketOverride === "up" ? Math.max(pUpBase, 0.72) : marketOverride === "down" ? Math.min(pUpBase, 0.28) : autoBias;
  return { period, left, target, price, pUp, upOdds: oddsFor(pUp), downOdds: oddsFor(1 - pUp), vol: volumeOf(m, period, elapsed), locked: left <= 3 };
}

/** Settles any finished rounds for the signed-in user; mounted once in the app shell. */
export function MarketSettler() {
  const s = useStore();
  const now = useNow(1000);
  const busy = useRef("");
  useEffect(() => {
    const due = s.bets.filter((b) => !b.settled && (b.period + 1) * b.dur <= now).sort((a, b) => a.period - b.period)[0];
    if (!due) return;
    const key = `${due.kind}-${due.period}`;
    if (busy.current === key) return;
    busy.current = key;
    const m = MARKETS.find((x) => x.id === due.kind);
    if (!m) return;
    const roundBets = s.bets.filter((b) => b.kind === due.kind && b.dur === due.dur && b.period === due.period);
    const upVolume = roundBets.filter((b) => b.sel === "up").reduce((sum, b) => sum + b.amount, 0);
    const downVolume = roundBets.filter((b) => b.sel === "down").reduce((sum, b) => sum + b.amount, 0);
    const r = resultFor(m, due.period, upVolume, downVolume, s.marketOverride);
    const won = s.settle(due.kind, due.dur, due.period, r, (b) => (b.sel === r ? +(b.amount * b.odds).toFixed(2) : 0));
    if (won > 0) toast.success(`${m.name} closed ${r.toUpperCase()} — you won ${money(won)}!`);
    else toast(`${m.name} closed ${r.toUpperCase()}`);
  }, [now, s]);
  return null;
}

function OddsRow({ side, odds, p, onClick, disabled }: { side: Side; odds: number; p: number; onClick?: () => void; disabled?: boolean }) {
  const up = side === "up";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
      <div className="min-w-0">
        <p className="font-semibold">{up ? "Buy Up" : "Sell Down"}</p>
        <div className="mt-1.5 h-[3px] rounded-full bg-secondary">
          <div className={`h-full rounded-full transition-all duration-500 ${up ? "bg-win-green" : "bg-win-red"}`} style={{ width: `${Math.round(p * 100)}%` }} />
        </div>
      </div>
      <span className="text-sm tabular-nums text-muted-foreground">{odds.toFixed(2)}x</span>
      <button disabled={disabled} onClick={onClick} className={`w-24 rounded-full border-2 py-2 font-bold tabular-nums transition active:scale-95 disabled:opacity-40 ${up ? "border-win-green hover:bg-win-green/15" : "border-win-red hover:bg-win-red/15"}`}>
        {Math.round(p * 100)}%
      </button>
    </div>
  );
}

export function MarketCard({ m, now, onBet }: { m: Market; now: number; onBet: (m: Market, side: Side) => void }) {
  const st = useMarketState(m, now);
  const Icon = marketIcon[m.id];
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-card p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <Link to="/markets/$id" params={{ id: m.id }} className="block">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-red shadow-red"><Icon className="h-5 w-5 text-primary-foreground" /></div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{m.symbol} · {m.tag}</p>
            <p className="truncate font-display text-xl font-bold">{m.name}</p>
          </div>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Live</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Target <span className="font-semibold text-foreground tabular-nums">${fmtPrice(st.target)}</span> · Now <span className={`font-semibold tabular-nums ${st.price >= st.target ? "text-win-green" : "text-win-red"}`}>${fmtPrice(st.price)}</span></p>
      </Link>
      <div className="mt-4 space-y-3">
        <OddsRow side="up" odds={st.upOdds} p={st.pUp} disabled={st.locked} onClick={() => onBet(m, "up")} />
        <OddsRow side="down" odds={st.downOdds} p={1 - st.pUp} disabled={st.locked} onClick={() => onBet(m, "down")} />
      </div>
      <p className="mt-4 text-sm"><span className="font-semibold text-gold tabular-nums">{fmtClock(st.left)}</span><span className="ml-3 text-muted-foreground">${(st.vol / 1000).toFixed(2)}K Vol.</span></p>
    </div>
  );
}

export function PriceChart({ m, now }: { m: Market; now: number }) {
  const period = periodOf(m, now);
  const target = targetOf(m, period);
  const { bets, marketOverride } = useStore();
  const roundBets = bets.filter((b) => b.kind === m.id && b.dur === m.dur && b.period === period);
  const upVolume = roundBets.filter((b) => b.sel === "up").reduce((sum, b) => sum + b.amount, 0);
  const downVolume = roundBets.filter((b) => b.sel === "down").reduce((sum, b) => sum + b.amount, 0);
  const candles = useMemo(() => {
    const end = Math.floor(now);
    return Array.from({ length: 32 }, (_, index) => {
      const closeTime = end - 31 + index;
      const open = priceAt(m, closeTime - 1);
      const close = index === 31 ? priceAt(m, now) : priceAt(m, closeTime);
      const mid = priceAt(m, closeTime - 0.5);
      const high = Math.max(open, close, mid);
      const low = Math.min(open, close, mid);
      return { open, close, high, low };
    });
  }, [m, now]);
  const all = candles.flatMap((c) => [c.high, c.low]).concat(target);
  const min = Math.min(...all), max = Math.max(...all), pad = (max - min) * 0.15 || 1;
  const y = (value: number) => 100 - ((value - (min - pad)) / (max - min + pad * 2)) * 100;
  const last = candles[candles.length - 1].close;
  return (
    <div className="relative h-52 w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-label="Live one-second candlestick chart" role="img">
        {[20, 40, 60, 80].map((value) => <line key={value} x1="0" x2="100" y1={value} y2={value} stroke="var(--border)" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />)}
        <line x1="0" x2="100" y1={y(target)} y2={y(target)} stroke="var(--gold)" strokeDasharray="2 2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {candles.map((candle, index) => {
          const x = 2 + (index / (candles.length - 1)) * 96;
          const rising = candle.close >= candle.open;
          const bodyTop = Math.min(y(candle.open), y(candle.close));
          const bodyHeight = Math.max(1.2, Math.abs(y(candle.close) - y(candle.open)));
          const color = rising ? "var(--win-green)" : "var(--win-red)";
          return <g key={index}><line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="0.8" vectorEffect="non-scaling-stroke" /><rect x={x - 1.05} y={bodyTop} width="2.1" height={bodyHeight} fill={color} rx="0.25" /></g>;
        })}
      </svg>
      <span className="absolute right-0 rounded bg-gold px-1.5 text-[10px] font-bold text-background" style={{ top: `calc(${y(target)}% - 8px)` }}>TARGET</span>
      <span className="absolute bottom-1 left-1 text-[10px] text-muted-foreground">1s</span>
      <span className={`absolute right-0 h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2 rounded-full ${last >= target ? "bg-win-green" : "bg-win-red"} ring-4 ring-background`} style={{ top: `${y(last)}%` }} />
    </div>
  );
}

export function BetSheet({ bet, onClose }: { bet: { m: Market; side: Side } | null; onClose: () => void }) {
  return bet ? <BetSheetInner bet={bet} onClose={onClose} /> : null;
}

function BetSheetInner({ bet, onClose }: { bet: { m: Market; side: Side }; onClose: () => void }) {
  const s = useStore();
  const now = useNow(250);
  const [amt, setAmt] = useState("100");
  const st = useMarketState(bet.m, now);
  const odds = 2;
  const n = Number(amt) || 0;
  const up = bet.side === "up";
  const confirm = async () => {
    if (n < 10) return toast.error("Minimum bet is ₹10");
    if (st.locked) return toast.error("Round is closing — wait for the next one");
    if (s.balance < n) return toast.error("Insufficient balance");
    try {
      const roundId = `${bet.m.id}-${st.period}`;
      await placeSharedBet({ roundId, marketId: bet.m.id, side: bet.side === "up" ? "UP" : "DOWN", amount: n });
      if (!s.placeBet({ kind: bet.m.id, dur: bet.m.dur, period: st.period, sel: bet.side, odds, target: st.target, amount: n })) return toast.error("Insufficient balance");
      toast.success(`${up ? "UP" : "DOWN"} ${money(n)} @ ${odds.toFixed(2)}x on ${bet.m.name}`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bet could not be placed");
    }
  };
  return (
    <BottomSheet open onClose={onClose} title={`${bet.m.name} · ${up ? "Up" : "Down"}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-secondary p-2"><p className="text-muted-foreground">Target</p><p className="font-semibold tabular-nums">${fmtPrice(st.target)}</p></div>
          <div className="rounded-xl bg-secondary p-2"><p className="text-muted-foreground">Payout</p><p className={`font-semibold tabular-nums ${up ? "text-win-green" : "text-win-red"}`}>{odds.toFixed(2)}x</p></div>
          <div className="rounded-xl bg-secondary p-2"><p className="text-muted-foreground">Closes in</p><p className="font-semibold tabular-nums text-gold">{fmtClock(st.left)}</p></div>
        </div>
        <input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} className={`${inputCls} text-center font-display text-3xl font-bold`} />
        <div className="grid grid-cols-5 gap-2">{[10, 50, 100, 500].map((v) => (
          <button key={v} onClick={() => setAmt(String(v))} className="rounded-lg bg-secondary py-2 text-sm font-semibold">{v}</button>
        ))}<button onClick={() => setAmt(String(Math.floor(s.balance)))} className="rounded-lg bg-secondary py-2 text-sm font-semibold">Max</button></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Potential payout</span><span className="font-bold tabular-nums">{money(n * odds)}</span></div>
        <button onClick={confirm} disabled={st.locked} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50 ${up ? "bg-win-green" : "bg-win-red"}`}>
          {up ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}{up ? "Buy Up" : "Sell Down"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Balance {money(s.balance)}</p>
      </div>
    </BottomSheet>
  );
}

export function MyPositions({ marketId, activeOnly = false }: { marketId?: string; activeOnly?: boolean }) {
  const s = useStore();
  const list = s.bets.filter((b) => (!marketId || b.kind === marketId) && (!activeOnly || !b.settled)).slice(0, 30);
  if (!list.length) return <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground"><Activity className="mx-auto mb-2 h-5 w-5" />No positions yet</p>;
  return (
    <div className="space-y-2">
      {list.map((b) => {
        const m = MARKETS.find((x) => x.id === b.kind);
        return (
          <div key={b.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3">
            <span className={`grid h-9 w-9 place-items-center rounded-full ${b.sel === "up" ? "bg-win-green/15 text-win-green" : "bg-win-red/15 text-win-red"}`}>{b.sel === "up" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{m?.name ?? b.kind} · {b.sel === "up" ? "Buy Up" : "Sell Down"} @ {b.odds?.toFixed(2)}x</p>
              <p className="truncate text-xs text-muted-foreground tabular-nums">{m ? roundLabel(m, b.period) : ""} · {money(b.amount)}</p>
            </div>
            <span className={`text-sm font-bold tabular-nums ${!b.settled ? "text-gold" : b.won ? "text-win-green" : "text-muted-foreground"}`}>{!b.settled ? "Open" : b.won ? `+${money(b.won)}` : "Lost"}</span>
          </div>
        );
      })}
    </div>
  );
}
