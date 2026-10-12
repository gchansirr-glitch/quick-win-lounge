import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { TrendingUp, TrendingDown, CircleDot, ShieldCheck, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BetSheet, MyPositions, PriceChart, marketIcon, useMarketState, useNow } from "@/components/markets";
import { MARKETS, fmtClock, fmtPrice, resultOf, roundLabel, closeOf, type Side } from "@/lib/market";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/markets/$id")({
  loader: ({ params }) => {
    const m = MARKETS.find((x) => x.id === params.id);
    if (!m) throw notFound();
    return { id: m.id, name: m.name, tag: m.tag };
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [
    { title: `${loaderData.name} (${loaderData.tag}) — TP LOTTERY` },
    { name: "description", content: `Predict whether ${loaderData.name} closes Up or Down each ${loaderData.tag} round.` },
    { property: "og:title", content: `${loaderData.name} — TP LOTTERY` },
    { property: "og:description", content: `Up/Down prediction market with ${loaderData.tag} rounds.` },
  ] : [{ title: "Market not found" }, { name: "robots", content: "noindex" }] }),
  component: MarketDetail,
});

function MarketDetail() {
  const { id } = Route.useLoaderData();
  const m = MARKETS.find((x) => x.id === id)!;
  const now = useNow(250);
  const st = useMarketState(m, now);
  const s = useStore();
  const [bet, setBet] = useState<{ m: typeof m; side: Side } | null>(null);
  const [tab, setTab] = useState<"position" | "mine" | "history">("position");
  const Icon = marketIcon[m.id];
  const diff = st.price - st.target;
  const pct = (st.left / m.dur) * 100;
  const history = Array.from({ length: 12 }, (_, i) => st.period - 1 - i);
  const fixedOdds = 2;
  const markets = MARKETS;

  return (
    <AppShell title={m.name} back nav={false}>
      <div className="space-y-4 pb-28">
        <div className="grid grid-cols-3 gap-2">
          {markets.map((market) => <a key={market.id} href={`/markets/${market.id}`} className={`rounded-2xl border p-2.5 text-center transition ${market.id === m.id ? "border-primary bg-primary text-primary-foreground" : "border-white/10 bg-card text-muted-foreground"}`}><div className="mx-auto mb-1 grid size-7 place-items-center rounded-lg bg-black/20"><span className="text-xs font-bold">{market.symbol.slice(0, 2)}</span></div><p className="truncate text-[11px] font-bold">{market.name}</p><p className="mt-0.5 text-[10px] opacity-70">{market.tag} rounds</p></a>)}
        </div>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-red shadow-red"><Icon className="h-6 w-6 text-primary-foreground" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs"><span className="font-bold">{m.symbol}</span><span className="flex items-center gap-1 text-win-green"><CircleDot className="size-2.5 fill-current" />Live</span></div>
            <p className="font-display text-3xl font-bold tabular-nums">${fmtPrice(st.price)}</p>
            <p className={`text-sm font-semibold tabular-nums ${diff >= 0 ? "text-win-green" : "text-win-red"}`}>{diff >= 0 ? "▲" : "▼"} {fmtPrice(Math.abs(diff))} vs target</p>
          </div>
          <div className="relative ml-auto grid h-16 w-16 shrink-0 place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="16" fill="none" stroke="var(--secondary)" strokeWidth="3" /><circle cx="18" cy="18" r="16" fill="none" stroke={st.locked ? "var(--primary)" : "var(--gold)"} strokeWidth="3" strokeDasharray={`${pct} 100`} pathLength={100} strokeLinecap="round" /></svg>
            <span className={`text-sm font-bold tabular-nums ${st.left < 10 ? "text-primary" : "text-gold"}`}>{fmtClock(st.left)}</span>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-gradient-card p-4">
          <PriceChart m={m} now={now} />
          <div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>Target <b className="text-gold tabular-nums">${fmtPrice(st.target)}</b></span><span>${(st.vol / 1000).toFixed(2)}K Vol.</span></div>
        </div>

        <div className="overflow-hidden rounded-full bg-secondary">
          <div className="flex h-8 text-xs font-bold">
            <div className="flex items-center bg-win-green/80 pl-3 transition-all duration-500" style={{ width: `${st.pUp * 100}%` }}>UP {Math.round(st.pUp * 100)}%</div>
            <div className="flex flex-1 items-center justify-end bg-win-red/80 pr-3">{Math.round((1 - st.pUp) * 100)}% DOWN</div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-white/10">
          {(["position", "mine", "history"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-3 text-xs font-bold ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>{t === "position" ? "Position" : t === "mine" ? "My History" : "Game History"}{t === "position" && <span className="ml-1 rounded-full bg-white/10 px-1.5">{s.bets.filter((b) => !b.settled && b.kind === m.id).length}</span>}</button>)}
        </div>
        {tab === "position" ? <MyPositions marketId={m.id} activeOnly /> : tab === "mine" ? <MyPositions marketId={m.id} /> : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card text-sm">
            {history.map((p) => {
              const r = resultOf(m, p);
              return (
                <div key={p} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
                  <span className="truncate font-mono text-xs text-muted-foreground">{roundLabel(m, p)}</span>
                  <span className="text-xs tabular-nums">${fmtPrice(closeOf(m, p))}</span>
                  <span className={`flex w-16 items-center justify-end gap-1 text-xs font-bold ${r === "up" ? "text-win-green" : "text-win-red"}`}>{r === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{r.toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-md grid-cols-2 gap-3 border-t border-border bg-surface/95 p-4 backdrop-blur">
        <button disabled={st.locked} onClick={() => setBet({ m, side: "up" })} className="flex items-center justify-center gap-2 rounded-xl bg-win-green py-3 font-bold text-primary-foreground active:scale-95 disabled:opacity-40"><ArrowUpRight className="size-4" />Buy Up · {fixedOdds.toFixed(2)}x</button>
        <button disabled={st.locked} onClick={() => setBet({ m, side: "down" })} className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground active:scale-95 disabled:opacity-40"><ArrowDownRight className="size-4" />Sell Down · {fixedOdds.toFixed(2)}x</button>
      </div>
      <BetSheet bet={bet} onClose={() => setBet(null)} />
    </AppShell>
  );
}
