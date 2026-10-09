import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, SlidersHorizontal, Users, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useStore, money } from "@/lib/store";
import { MARKETS, type Side } from "@/lib/market";

export const Route = createFileRoute("/admin")({ component: AdminDashboard });

function AdminDashboard() {
  const { user, ready, marketOverride, setMarketOverride, txs } = useStore();
  const navigate = useNavigate();
  const [override, setOverride] = useState<Side | null>(marketOverride);
  useEffect(() => { if (ready && (!user || !user.isAdmin)) navigate({ to: "/" }); }, [ready, user, navigate]);
  if (!ready || !user?.isAdmin) return null;
  const demoUsers = [{ email: "acagaming75@gmail.com", role: "Admin", status: "Active" }, { email: "trader.one@gmail.com", role: "User", status: "Active" }, { email: "demo.user@gmail.com", role: "User", status: "Pending" }];
  const requests = txs.filter((t) => t.type === "deposit" || t.type === "withdraw").slice(0, 8);
  const apply = (side: Side | null) => { setOverride(side); setMarketOverride(side); toast.success(side ? `Manual direction set to ${side === "up" ? "Up" : "Down"}` : "Automatic market direction enabled"); };
  return <AppShell title="Admin Dashboard" back>
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Admin access</p><p className="mt-1 font-semibold">{user.email}</p><p className="mt-1 text-xs text-muted-foreground">Frontend demo controls — data is stored locally in this browser.</p></div>
      <section className="rounded-2xl bg-card p-4"><div className="mb-4 flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Market direction</h2></div><p className="mb-3 text-sm text-muted-foreground">Automatic mode favors the lower-volume side. Use an override for simulation testing.</p><div className="grid grid-cols-3 gap-2"><button onClick={() => apply(null)} className={`rounded-xl px-2 py-3 text-sm font-semibold ${!override ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Auto</button><button onClick={() => apply("up")} className={`rounded-xl px-2 py-3 text-sm font-semibold ${override === "up" ? "bg-win-green text-background" : "bg-secondary"}`}>Up</button><button onClick={() => apply("down")} className={`rounded-xl px-2 py-3 text-sm font-semibold ${override === "down" ? "bg-win-red text-background" : "bg-secondary"}`}>Down</button></div><p className="mt-3 text-xs text-muted-foreground">Current: <span className="font-semibold text-foreground">{override ? override.toUpperCase() : "AUTOMATIC"}</span></p></section>
      <section className="rounded-2xl bg-card p-4"><div className="mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Users</h2></div><div className="flex flex-col gap-2">{demoUsers.map((u) => <div key={u.email} className="flex items-center justify-between rounded-xl bg-secondary p-3"><div><p className="text-sm font-semibold">{u.email}</p><p className="text-xs text-muted-foreground">{u.role}</p></div><span className="rounded-full bg-background px-2 py-1 text-xs">{u.status}</span></div>)}</div></section>
      <section className="rounded-2xl bg-card p-4"><div className="mb-4 flex items-center gap-2"><WalletCards className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Transaction requests</h2></div>{requests.length ? <div className="flex flex-col gap-2">{requests.map((t) => <div key={t.id} className="flex items-center justify-between rounded-xl bg-secondary p-3"><div><p className="text-sm font-semibold capitalize">{t.type} request</p><p className="text-xs text-muted-foreground">{t.note}</p></div><div className="text-right"><p className="font-bold">{money(Math.abs(t.amount))}</p><button onClick={() => toast.success("Request marked reviewed")} className="mt-1 inline-flex items-center gap-1 text-xs text-primary"><Check className="h-3 w-3" />Review</button></div></div>)}</div> : <p className="text-sm text-muted-foreground">No local transaction requests yet.</p>}</section>
      <div className="flex items-center justify-between rounded-2xl border border-border p-4"><div><p className="font-semibold">Market catalog</p><p className="text-xs text-muted-foreground">{MARKETS.length} simulated markets active</p></div><Link to="/" className="text-sm font-semibold text-primary">Back home <ArrowLeft className="ml-1 inline h-4 w-4 rotate-180" /></Link></div>
    </div>
  </AppShell>;
}
