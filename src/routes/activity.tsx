import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Gift, Trophy, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore, money } from "@/lib/store";
import { btnPrimary, inputCls } from "@/components/Sheet";

export const Route = createFileRoute("/activity")({
  head: () => ({ meta: [
    { title: "Activity & Bonuses — TP LOTTERY" },
    { name: "description", content: "Claim daily sign-in rewards, bonuses and redeem gift codes." },
    { property: "og:title", content: "Activity & Bonuses — TP LOTTERY" },
    { property: "og:description", content: "Daily rewards and gift codes." },
  ] }),
  component: Activity,
});

function Activity() {
  const s = useStore();
  const [code, setCode] = useState("");
  const today = new Date().toDateString();
  const done = s.lastCheckIn === today;
  const betToday = s.bets.filter((b) => new Date(b.at).toDateString() === today).reduce((a, b) => a + b.amount, 0);
  const claimedKey = `daily-${today}`;
  const [claimed, setClaimed] = useState(false);
  const alreadyClaimed = claimed || s.txs.some((t) => t.note === claimedKey);

  return (
    <AppShell title="Activity">
      <div className="space-y-4">
        <section className="rounded-2xl border border-border bg-gradient-card p-4">
          <div className="mb-3 flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Daily sign-in</h2></div>
          <div className="mb-4 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, i) => {
              const got = i < s.streak && (done || s.lastCheckIn === new Date(Date.now() - 864e5).toDateString());
              return (
                <div key={i} className={`flex flex-col items-center rounded-lg py-2 text-[11px] ${got ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {got ? <Check className="h-4 w-4" /> : <span className="font-bold">MMK {(i + 1) * 5}</span>}
                  <span>D{i + 1}</span>
                </div>
              );
            })}
          </div>
          <button disabled={done} className={btnPrimary} onClick={() => { const a = s.checkIn(); if (a) toast.success(`Signed in! +${money(a)}`); }}>{done ? "Signed in today" : "Sign in now"}</button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2"><Trophy className="h-5 w-5 text-gold" /><h2 className="text-lg font-bold">Daily betting bonus</h2></div>
          <p className="text-sm text-muted-foreground">Bet MMK 100 today to claim MMK 10.</p>
          <div className="my-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-gradient-red" style={{ width: `${Math.min(100, betToday)}%` }} /></div>
          <p className="mb-3 text-xs text-muted-foreground">{money(Math.min(betToday, 100))} / MMK 100.00</p>
          <button disabled={betToday < 100 || alreadyClaimed} className={btnPrimary} onClick={() => { s.bonus(10, claimedKey); setClaimed(true); toast.success("+MMK 10 bonus claimed"); }}>{alreadyClaimed ? "Claimed" : "Claim MMK 10"}</button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Redeem gift code</h2></div>
          <div className="space-y-3">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter gift code" className={inputCls} />
            <button className={btnPrimary} onClick={() => { const a = s.redeem(code); if (a) { toast.success(`Redeemed +${money(a)}`); setCode(""); } else toast.error("Invalid or already used code"); }}>Redeem</button>
            <p className="text-xs text-muted-foreground">Try: TPWELCOME, LUCKY88, REDHOT</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
