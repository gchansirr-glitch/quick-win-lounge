import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BetSheet, MarketCard, MyPositions, useNow } from "@/components/markets";
import { MARKETS, type Market, type Side } from "@/lib/market";

export const Route = createFileRoute("/markets/")({
  head: () => ({ meta: [
    { title: "Prediction Markets — Trade X" },
    { name: "description", content: "Predict Up or Down on Micro Volatx (30s), Alpha Dynamic (1m) and Prime Macro (5m)." },
    { property: "og:title", content: "Prediction Markets — Trade X" },
    { property: "og:description", content: "Up/Down prediction markets with 30s, 1m and 5m rounds." },
  ] }),
  component: Markets,
});

const FILTERS = [{ k: "all", l: "All" }, { k: 30, l: "30s" }, { k: 60, l: "1 Min" }, { k: 300, l: "5 Min" }] as const;

function Markets() {
  const now = useNow(250);
  const [f, setF] = useState<(typeof FILTERS)[number]["k"]>("all");
  const [tab, setTab] = useState<"markets" | "positions">("markets");
  const [bet, setBet] = useState<{ m: Market; side: Side } | null>(null);
  const list = MARKETS.filter((m) => f === "all" || m.dur === f);
  return (
    <AppShell title="Prediction Markets">
      <div className="-mx-4 mb-4 flex gap-6 border-b border-border px-4">
        {(["markets", "positions"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-3 font-semibold ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            {t === "markets" ? <><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-win-green align-middle" />Up/Down</> : "My positions"}
          </button>
        ))}
      </div>
      {tab === "markets" ? (
        <>
          <div className="mb-4 flex gap-5 text-[15px]">
            {FILTERS.map((x) => {
              const c = x.k === "all" ? MARKETS.length : MARKETS.filter((m) => m.dur === x.k).length;
              return <button key={x.k} onClick={() => setF(x.k)} className={f === x.k ? "font-semibold text-foreground" : "text-muted-foreground"}>{x.l} <span className="text-muted-foreground">{c}</span></button>;
            })}
          </div>
          <div className="space-y-4">{list.map((m) => <MarketCard key={m.id} m={m} now={now} onBet={(m, side) => setBet({ m, side })} />)}</div>
        </>
      ) : <MyPositions />}
      <BetSheet bet={bet} onClose={() => setBet(null)} />
    </AppShell>
  );
}
