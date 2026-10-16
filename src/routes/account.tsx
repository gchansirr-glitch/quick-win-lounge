import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Crown, Copy, Vault, History, Settings, LogOut, ChevronRight, Bell, Lock, Globe } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BottomSheet, btnPrimary, inputCls } from "@/components/Sheet";
import { useStore, money } from "@/lib/store";
import { MyPositions } from "@/components/markets";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [
    { title: "My Account — Trade X" },
    { name: "description", content: "Profile, VIP status, safe vault and game history." },
    { property: "og:title", content: "My Account — Trade X" },
    { property: "og:description", content: "Profile, VIP status, safe vault and game history." },
  ] }),
  component: Account,
});

function Account() {
  const s = useStore();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<"vault" | "history" | "settings" | null>(null);
  const [amt, setAmt] = useState("");
  const wagered = s.bets.reduce((a, b) => a + b.amount, 0);
  const vip = Math.min(10, Math.floor(wagered / 1000));
  const vipConfig = s.vipLevels.find((level) => level.level === vip) ?? s.vipLevels[0];
  const nextVip = s.vipLevels.find((level) => level.level > vip);

  const move = (to: boolean) => {
    const n = Number(amt);
    if (!n) return toast.error("Enter an amount");
    if (!s.moveVault(n, to)) return toast.error("Insufficient funds");
    toast.success(to ? "Moved to safe vault" : "Moved to wallet"); setAmt("");
  };

  const rows = [
    { k: "vault" as const, icon: Vault, label: "Safe vault", value: money(s.vault) },
    { k: "history" as const, icon: History, label: "Trade history", value: `${s.bets.length} bets` },
    { k: "settings" as const, icon: Settings, label: "Account settings", value: "" },
  ];

  return (
    <AppShell title="Account">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-red p-5 shadow-red text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-background/25 font-display text-2xl font-bold">{s.user!.email.slice(-2)}</div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-bold">{s.user!.email}<span className="flex shrink-0 items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs text-background"><Crown className="h-3 w-3" />VIP{vip}</span></p>
              <button onClick={() => { navigator.clipboard?.writeText(s.user!.uid); toast.success("UID copied"); }} className="flex items-center gap-1 text-sm opacity-90">UID {s.user!.uid}<Copy className="h-3 w-3" /></button>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background/25"><div className="h-full bg-gold" style={{ width: `${(wagered % 1000) / 10}%` }} /></div>
          <p className="mt-1 text-xs opacity-80">{money(1000 - (wagered % 1000))} more wagering to VIP{Math.min(10, vip + 1)}</p>
        </div>

        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-gold">VIP rewards</p><p className="mt-1 font-display text-xl font-bold">{vipConfig?.name ?? `VIP${vip}`}</p></div><Crown className="size-5 text-gold" /></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-muted-foreground">Commission</p><p className="font-bold">{vipConfig?.commissionPercent ?? 0}%</p></div><div><p className="text-muted-foreground">Upgrade bonus</p><p className="font-bold">{money(vipConfig?.upgradeBonus ?? 0)}</p></div><div><p className="text-muted-foreground">Monthly bonus</p><p className="font-bold">{money(vipConfig?.monthlyBonus ?? 0)}</p></div></div>{nextVip && <p className="mt-3 text-xs text-muted-foreground">Next: {nextVip.name} at {money(nextVip.wagerRequired)} wagering</p>}</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">Balance</p><p className="font-display text-2xl font-bold">{money(s.balance)}</p></div>
          <div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">Safe vault</p><p className="font-display text-2xl font-bold">{money(s.vault)}</p></div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-card">
          {rows.map(({ k, icon: Icon, label, value }) => (
            <button key={k} onClick={() => setSheet(k)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-4 py-4 text-left last:border-0">
              <Icon className="h-5 w-5 text-primary" /><span className="font-semibold">{label}</span><span className="text-sm text-muted-foreground">{value}</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {s.user?.isAdmin && <Link to="/admin" className="flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 p-4 text-left"><span className="flex items-center gap-3 font-semibold text-primary"><Crown className="h-5 w-5" />Admin Dashboard</span><ChevronRight className="h-5 w-5 text-primary" /></Link>}
        <button onClick={() => { s.logout(); nav({ to: "/login" }); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary py-3 font-semibold text-primary"><LogOut className="h-4 w-4" />Log out</button>
      </div>

      <BottomSheet open={sheet === "vault"} onClose={() => setSheet(null)} title="Safe vault">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Funds in the vault are protected and can't be used for bets.</p>
          <input inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} placeholder="Amount" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <button className={btnPrimary} onClick={() => move(true)}>Transfer in</button>
            <button className="rounded-xl bg-secondary py-3 font-bold" onClick={() => move(false)}>Transfer out</button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "history"} onClose={() => setSheet(null)} title="Trade history">
        <div className="max-h-[60vh] overflow-y-auto"><MyPositions /></div>
      </BottomSheet>

      <BottomSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Account settings">
        <div className="space-y-2">
          {[{ i: Lock, l: "Change login password" }, { i: Bell, l: "Notifications" }].map(({ i: I, l }) => (
            <button key={l} onClick={() => toast("Available in the full version")} className="flex w-full items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"><I className="h-5 w-5 text-primary" />{l}</button>
          ))}
          <div className="flex w-full items-center gap-3 rounded-xl bg-secondary px-4 py-3"><Globe className="h-5 w-5 text-primary" /><span>Language: English</span></div>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
