import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone, Plus, ArrowUpRight } from "lucide-react";
import { BetSheet, MarketCard, useNow } from "@/components/markets";
import { MARKETS, type Market, type Side } from "@/lib/market";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore, money } from "@/lib/store";
import banner2 from "@/assets/banner-2.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "TP LOTTERY — Home" },
    { name: "description", content: "Predict Up or Down on live markets, claim bonuses and manage your wallet." },
    { property: "og:title", content: "TP LOTTERY — Home" },
    { property: "og:description", content: "Up/Down prediction markets with 30s, 1m and 5m rounds." },
  ] }),
  component: Home,
});

const banners = [
  { img: "/prediction-markets-banner.png", title: "Prediction Markets", sub: "Call Up or Down in 30s, 1m and 5m rounds" },
  { img: banner2, title: "First Deposit Bonus", sub: "Get extra rewards today" },
];

function Home() {
  const { balance, vault } = useStore();
  const [b, setB] = useState(0);
  const now = useNow(250);
  const [bet, setBet] = useState<{ m: Market; side: Side } | null>(null);
  useEffect(() => { const t = setInterval(() => setB((x) => (x + 1) % banners.length), 4000); return () => clearInterval(t); }, []);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="relative aspect-[16/8] overflow-hidden rounded-2xl">
          {banners.map((x, i) => (
            <div key={i} className={`absolute inset-0 transition-opacity duration-700 ${i === b ? "opacity-100" : "opacity-0"}`}>
              <img src={x.img} alt={x.title} className="h-full w-full object-cover" width={1280} height={640} />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
              <div className="absolute bottom-3 left-4">
                <p className="font-display text-2xl font-bold">{x.title}</p>
                <p className="text-sm text-muted-foreground">{x.sub}</p>
              </div>
            </div>
          ))}
          <div className="absolute bottom-3 right-4 flex gap-1">{banners.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === b ? "w-5 bg-primary" : "w-1.5 bg-foreground/50"}`} />)}</div>
        </div>

        <div className="flex items-center gap-2 overflow-hidden rounded-full bg-card px-3 py-2 text-sm">
          <Megaphone className="h-4 w-4 shrink-0 text-primary" />
          <div className="overflow-hidden"><p className="animate-marquee whitespace-nowrap">Welcome to TP LOTTERY! Use gift code TPWELCOME for a free bonus · Daily sign-in rewards now live · Invite friends and earn commission</p></div>
        </div>

        <div className="rounded-2xl bg-gradient-red p-4 shadow-red text-primary-foreground">
          <p className="text-sm opacity-80">Wallet balance</p>
          <p className="font-display text-4xl font-bold">{money(balance)}</p>
          <p className="text-xs opacity-80">Safe vault: {money(vault)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/wallet" search={{ action: "deposit" }} className="flex items-center justify-center gap-1 rounded-xl bg-background/20 py-2 font-semibold"><Plus className="h-4 w-4" />Deposit</Link>
            <Link to="/wallet" search={{ action: "withdraw" }} className="flex items-center justify-center gap-1 rounded-xl bg-background/20 py-2 font-semibold"><ArrowUpRight className="h-4 w-4" />Withdraw</Link>
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Prediction markets</h2><Link to="/markets" className="text-sm font-semibold text-primary">View all</Link></div>
          <div className="space-y-4">{MARKETS.map((m) => <MarketCard key={m.id} m={m} now={now} onBet={(m, side) => setBet({ m, side })} />)}</div>
          <BetSheet bet={bet} onClose={() => setBet(null)} />
        </section>
      </div>
    </AppShell>
  );
}
