import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Crown, Copy, Vault, History, Settings, LogOut, ChevronRight, Bell, Lock, Globe, Gamepad2, ArrowDownToLine, ArrowUpFromLine, ReceiptText, UserRound, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BottomSheet, btnPrimary, inputCls } from "@/components/Sheet";
import { useStore, money, type Tx } from "@/lib/store";
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
  const [sheet, setSheet] = useState<"vault" | "history" | "settings" | "transactions" | null>(null);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [personalInfoOpen, setPersonalInfoOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"all" | Tx["type"]>("all");
  const [transactionDate, setTransactionDate] = useState("all");
  const [amt, setAmt] = useState("");
  const userId = s.user?.uid ?? "00000000";
  const memberName = `MEMBER_${userId.slice(-6)}`;
  const lastLoginAt = s.user?.lastLoginAt ?? Date.now();
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };
  const openTransactions = (filter: "all" | Tx["type"]) => { setTransactionType(filter); setTransactionDate("all"); setSheet("transactions"); };
  const transactionRows = s.txs.filter((transaction) => {
    if (transactionType !== "all" && transaction.type !== transactionType) return false;
    if (transactionDate === "all") return true;
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(dayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate() - 6);
    if (transactionDate === "today") return transaction.at >= dayStart.getTime();
    if (transactionDate === "yesterday") return transaction.at >= yesterdayStart.getTime() && transaction.at < dayStart.getTime();
    return transaction.at >= weekStart.getTime();
  }).sort((a, b) => b.at - a.at);
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
    { k: "settings" as const, icon: Settings, label: "Account settings", value: "" },
  ];
  const historyShortcuts = [
    { title: "Game History", subtitle: "My game history", icon: Gamepad2, action: () => setSheet("history") },
    { title: "Transaction", subtitle: "My transaction history", icon: ReceiptText, action: () => openTransactions("all") },
    { title: "Deposit", subtitle: "My deposit history", icon: ArrowDownToLine, action: () => openTransactions("deposit") },
    { title: "Withdraw", subtitle: "My withdraw history", icon: ArrowUpFromLine, action: () => openTransactions("withdraw") },
  ];

  return (
    <AppShell title="Account">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-red p-5 shadow-red text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-background/25 font-display text-2xl font-bold">{userId.slice(-2)}</div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-bold">{memberName}<span className="flex shrink-0 items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs text-background"><Crown className="h-3 w-3" />VIP{vip}</span></p>
              <button onClick={() => { navigator.clipboard?.writeText(userId); toast.success("UID copied to clipboard"); }} className="flex items-center gap-1 text-sm opacity-90">UID | {userId}<Copy className="h-3 w-3" /></button>
              <p className="mt-1 text-[11px] opacity-75">Last login: {formatDateTime(lastLoginAt)}</p>
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

        <div className="grid grid-cols-2 gap-3">{historyShortcuts.map(({ title, subtitle, icon: Icon, action }) => <button key={title} onClick={action} className="min-h-28 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/50"><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p></button>)}</div>

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

      <BottomSheet open={sheet === "history"} onClose={() => setSheet(null)} title="Game History">
        <div className="max-h-[60vh] overflow-y-auto"><MyPositions /></div>
      </BottomSheet>

      <BottomSheet open={sheet === "transactions"} onClose={() => setSheet(null)} title="Transaction history">
        <div className="max-h-[72vh] space-y-4 overflow-y-auto pb-2">
          <button onClick={() => setSheet(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" /> Transaction history</button>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-muted-foreground">Type<select value={transactionType} onChange={(event) => setTransactionType(event.target.value as "all" | Tx["type"])} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"><option value="all">All</option><option value="deposit">Deposit</option><option value="withdraw">Withdraw</option><option value="bet">Bet</option><option value="win">Win</option><option value="bonus">Bonus</option><option value="commission">Commission</option><option value="vault">Safe vault</option></select></label><label className="text-xs font-semibold text-muted-foreground">Date<select value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"><option value="all">All dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">Last 7 days</option></select></label></div>
          {transactionRows.length ? <div className="space-y-3">{transactionRows.map((transaction) => { const categories: Record<Tx["type"], string> = { deposit: "Deposit", withdraw: "Withdraw", bet: "Bet", win: "Win", bonus: "Bonus", commission: "One-Click rebate", vault: "Safe vault" }; return <article key={transaction.id} className="overflow-hidden rounded-2xl border border-border bg-card"><div className="bg-secondary px-4 py-2 text-sm font-bold">{categories[transaction.type]}</div><div className="space-y-2 p-4 text-sm"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Detail</span><span className="text-right font-medium">{transaction.note}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Time</span><span className="text-right text-xs">{formatDateTime(transaction.at)}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Balance</span><span className={`font-bold tabular-nums ${transaction.amount >= 0 ? "text-win-green" : "text-win-red"}`}>{transaction.amount >= 0 ? "+" : "−"}{money(Math.abs(transaction.amount))}</span></div></div></article>; })}</div> : <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-border p-6 text-center"><div><ReceiptText className="mx-auto h-10 w-10 text-muted-foreground/50" /><p className="mt-3 font-semibold">No data</p><p className="mt-1 text-xs text-muted-foreground">No transactions match these filters.</p></div></div>}
        </div>
      </BottomSheet>

      <BottomSheet open={personalInfoOpen} onClose={() => setPersonalInfoOpen(false)} title="Personal Information">
        <div className="space-y-3">{[["Phone Number", s.user?.phone || "Not linked"], ["Email Address", s.user?.email || "Not linked"], ["UID", userId]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-4"><span className="text-sm text-muted-foreground">{label}</span><span className="break-all text-right text-sm font-semibold">{value}</span></div>)}<p className="text-xs text-muted-foreground">Your registered contact information is only shown here in Account Settings.</p></div>
      </BottomSheet>

      <BottomSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Account settings">
        <div className="space-y-2">
          <button onClick={() => setPersonalInfoOpen(true)} className="flex w-full items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"><UserRound className="h-5 w-5 text-primary" /><span>Personal Information</span><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></button>
          {[{ i: Lock, l: "Change login password" }, { i: Bell, l: "Notifications" }].map(({ i: I, l }) => (
            <button key={l} onClick={() => toast("Available in the full version")} className="flex w-full items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"><I className="h-5 w-5 text-primary" />{l}</button>
          ))}
          <button onClick={() => setLanguageOpen(true)} className="flex w-full items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"><Globe className="h-5 w-5 text-primary" /><span>Language: {s.lang === "my" ? "မြန်မာစာ" : "English"}</span><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></button>
        </div>
      </BottomSheet>
      <BottomSheet open={languageOpen} onClose={() => setLanguageOpen(false)} title="Select language">
        <div className="space-y-2">{[{ code: "en" as const, label: "🇬🇧 English" }, { code: "my" as const, label: "🇲🇲 မြန်မာစာ" }].map((option) => <button key={option.code} onClick={() => { s.setLanguage(option.code); setLanguageOpen(false); toast.success(option.code === "my" ? "ဘာသာစကား ပြောင်းပြီးပါပြီ" : "Language updated"); }} className={`flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left font-semibold ${s.lang === option.code ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary"}`}><span>{option.label}</span>{s.lang === option.code && <span className="text-xs">Selected</span>}</button>)}</div>
      </BottomSheet>
    </AppShell>
  );
}
