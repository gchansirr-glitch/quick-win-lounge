import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Users, Crown, Link2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore, money } from "@/lib/store";
import { seeded } from "@/lib/market";

export const Route = createFileRoute("/promotion")({
  head: () => ({ meta: [
    { title: "Promotion & Referrals — Trade X" },
    { name: "description", content: "Invite friends, track subordinates and earn agent commissions." },
    { property: "og:title", content: "Promotion & Referrals — Trade X" },
    { property: "og:description", content: "Invite friends and earn commissions." },
  ] }),
  component: Promotion,
});

const tiers = [
  { lv: "L1", need: 0, rate: "0.6%" },
  { lv: "L2", need: 5, rate: "0.8%" },
  { lv: "L3", need: 20, rate: "1.0%" },
  { lv: "L4", need: 50, rate: "1.2%" },
];

function Promotion() {
  const { user } = useStore();
  const code = user!.inviteCode;
  const link = typeof window !== "undefined" ? `${window.location.origin}/login?invite=${code}` : "";
  const seed = seeded(code);
  const direct = seed % 9, team = direct + (seed % 23);
  const commission = (seed % 5000) / 10;
  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast.success("Copied"); };
  const cur = [...tiers].reverse().find((t) => team >= t.need)!;

  return (
    <AppShell title="Promotion">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-red p-5 text-center shadow-red text-primary-foreground">
          <p className="text-sm opacity-80">Yesterday's total commission</p>
          <p className="font-display text-4xl font-bold">{money(commission)}</p>
          <p className="text-xs opacity-80">Upgrade the level to increase commission income</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[["Direct subordinates", direct], ["Team subordinates", team], ["New today", seed % 3], ["First deposits", seed % 4]].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-card p-4"><Users className="mb-1 h-4 w-4 text-primary" /><p className="font-display text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
          ))}
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0"><p className="text-xs text-muted-foreground">Invitation code</p><p className="font-mono text-xl font-bold tracking-widest">{code}</p></div>
            <button onClick={() => copy(code)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Copy className="h-4 w-4" />Copy</button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0"><p className="text-xs text-muted-foreground">Referral link</p><p className="truncate text-sm">{link}</p></div>
            <button onClick={() => copy(link)} className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold"><Link2 className="h-4 w-4" />Copy</button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2"><Crown className="h-5 w-5 text-gold" /><h2 className="text-lg font-bold">Agent tiers</h2></div>
          {tiers.map((t) => (
            <div key={t.lv} className={`mb-2 grid grid-cols-3 rounded-xl px-3 py-2 text-sm ${t === cur ? "bg-accent ring-1 ring-primary" : "bg-secondary"}`}>
              <span className="font-bold">{t.lv}{t === cur && " · You"}</span><span className="text-center text-muted-foreground">{t.need}+ team</span><span className="text-right font-semibold text-primary">{t.rate}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
