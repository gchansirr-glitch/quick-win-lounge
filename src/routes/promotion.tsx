import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Users, Crown, Link2, CalendarDays, ChevronRight, Headphones, ScrollText, WalletCards, BarChart3, Search, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore, money } from "@/lib/store";
import { seeded } from "@/lib/market";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

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
  const [userCode, setUserCode] = useState("");
  const [view, setView] = useState<"home" | "subordinates">("home");
  const [subordinateSearch, setSubordinateSearch] = useState("");
  const [subordinateTier, setSubordinateTier] = useState("all");
  const [subordinates, setSubordinates] = useState<Array<{ user_id: string; user_code: string; registered_at: string; balance: number; total_deposit: number; total_bet_volume: number; total_commission: number }>>([]);
  useEffect(() => { if (!supabase || !user?.uid) return; void (async () => { const { data } = await (supabase as any).from("profiles").select("user_code").eq("id", user.uid).maybeSingle(); setUserCode(data?.user_code ?? ""); })(); }, [user?.uid]);
  useEffect(() => { if (!supabase || !user?.uid || view !== "subordinates") return; void (async () => { const { data } = await (supabase as any).rpc("get_agent_invited_users", { p_search: subordinateSearch.trim() || null }); setSubordinates(data ?? []); })(); }, [user?.uid, view, subordinateSearch]);
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
        {view === "subordinates" ? <>
          <button onClick={() => setView("home")} className="flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" /> Promotion center</button>
          <div className="rounded-2xl bg-gradient-red p-5 text-primary-foreground shadow-red"><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">အောက်လက်ငယ်သားဒေတာ</p><h1 className="mt-1 font-display text-2xl font-bold">Subordinate Data</h1><p className="mt-1 text-sm opacity-80">Direct and team activity overview</p></div>
          <div className="rounded-2xl border border-border bg-card p-4"><div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={subordinateSearch} onChange={(event) => setSubordinateSearch(event.target.value)} placeholder="လက်အောက် UID များ ရှာဖွေ" className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm" /></div><select value={subordinateTier} onChange={(event) => setSubordinateTier(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-2 text-xs"><option value="all">အားလုံး</option><option value="direct">တိုက်ရိုက်</option><option value="team">အဖွဲ့</option></select></div><p className="mt-2 text-xs text-muted-foreground">{new Date().toLocaleDateString()} · {subordinates.length} users</p></div>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">ငွေသွင်းဦးရေ</p><p className="mt-1 font-display text-2xl font-bold">{subordinates.filter((item) => item.total_deposit > 0).length}</p></div><div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">ငွေသွင်းပမာဏ</p><p className="mt-1 font-display text-lg font-bold">{money(subordinates.reduce((sum, item) => sum + Number(item.total_deposit), 0))}</p></div><div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">လောင်းကစားသူ</p><p className="mt-1 font-display text-2xl font-bold">{subordinates.filter((item) => item.total_bet_volume > 0).length}</p></div><div className="rounded-2xl bg-card p-4"><p className="text-xs text-muted-foreground">စုစုပေါင်းလောင်းကြေး</p><p className="mt-1 font-display text-lg font-bold">{money(subordinates.reduce((sum, item) => sum + Number(item.total_bet_volume), 0))}</p></div></div>
          <section className="space-y-3"><h2 className="font-display text-xl font-bold">Invited Users</h2>{subordinates.length ? subordinates.map((item) => <article key={item.user_id} className="rounded-2xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="font-mono font-bold">UID: {item.user_code}</p><button onClick={() => { navigator.clipboard?.writeText(item.user_code); toast.success("UID copied"); }} aria-label="Copy UID"><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button></div><p className="mt-1 text-xs text-muted-foreground">တိုက်ရိုက် · {new Date(item.registered_at).toLocaleString()}</p></div><p className="font-bold">{money(Number(item.balance))}</p></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-muted-foreground">ငွေသွင်း</p><p className="mt-1 font-semibold">{money(Number(item.total_deposit))}</p></div><div><p className="text-muted-foreground">လောင်းကြေး</p><p className="mt-1 font-semibold">{money(Number(item.total_bet_volume))}</p></div><div><p className="text-muted-foreground">ကော်မရှင်</p><p className="mt-1 font-semibold text-primary">{money(Number(item.total_commission))}</p></div></div></article>) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No subordinate data found.</div>}</section>
        </> : <>
        <div className="rounded-2xl bg-gradient-red p-5 text-center shadow-red text-primary-foreground">
          <p className="text-sm opacity-80">Yesterday's total commission</p>
          <p className="font-display text-4xl font-bold">{money(commission)}</p>
          <p className="text-xs opacity-80">Upgrade the level to increase commission income</p>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4"><p className="text-xs font-bold uppercase tracking-wider text-primary">Your User ID</p><div className="mt-1 flex items-center justify-between gap-3"><p className="font-mono text-2xl font-bold tracking-widest">{userCode || "—"}</p><button onClick={() => { navigator.clipboard?.writeText(userCode); toast.success("User ID copied"); }} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Copy</button></div><p className="mt-1 text-xs text-muted-foreground">Share your invitation code to grow your direct subordinates.</p></div>

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
        <div className="rounded-2xl border border-border bg-card p-2">
          {[{ label: "အောက်လက်ငယ်သားဒေတာ", sub: "Subordinate Data", icon: CalendarDays, action: () => setView("subordinates") }, { label: "ကော်မရှင်အသေးစိတ်", sub: "Commission Details", icon: WalletCards }, { label: "ဖိတ်ခေါ်စည်းကမ်း", sub: "Invitation Rules", icon: ScrollText }, { label: "အေးဂျင့်လိုင်းဖောက်သည်ဝန်ဆောင်မှု", sub: "Agent Customer Service", icon: Headphones }, { label: "ကော်မရှင်အချိုး", sub: "Commission Rebate Rates", icon: BarChart3 }].map((item) => <button key={item.sub} onClick={item.action} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-secondary"><item.icon className="h-5 w-5 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block text-xs text-muted-foreground">{item.sub}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>)}
        </div>
        </>}
      </div>
    </AppShell>
  );
}
