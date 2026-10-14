import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, ArrowUpRight, Pencil } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { BottomSheet, btnPrimary, inputCls } from "@/components/Sheet";
import { TxList } from "@/components/TxList";
import { useStore, money } from "@/lib/store";

export const Route = createFileRoute("/wallet")({
  validateSearch: z.object({ action: z.enum(["deposit", "withdraw"]).optional() }),
  head: () => ({ meta: [
    { title: "Wallet — TP LOTTERY" },
    { name: "description", content: "Check your balance, deposit, withdraw and view transaction history." },
    { property: "og:title", content: "Wallet — TP LOTTERY" },
    { property: "og:description", content: "Balance, deposits, withdrawals and history." },
  ] }),
  component: WalletPage,
});

const METHODS = ["KPay", "Wave Pay", "UPI", "USDT TRC20"];

function WalletPage() {
  const s = useStore();
  const { action } = Route.useSearch();
  const [open, setOpen] = useState<"deposit" | "withdraw" | null>(null);
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [acct, setAcct] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [editingAccounts, setEditingAccounts] = useState(false);
  const [accountDraft, setAccountDraft] = useState(s.paymentAccounts);
  const [filter, setFilter] = useState<"all" | "deposit" | "withdraw" | "game">("all");
  useEffect(() => { if (action) setOpen(action); }, [action]);

  const txs = s.txs.filter((t) => filter === "all" || (filter === "game" ? t.type === "bet" || t.type === "win" : t.type === filter)).slice(0, 50);
  const dep = s.txs.filter((t) => t.type === "deposit").reduce((a, t) => a + t.amount, 0);
  const wd = -s.txs.filter((t) => t.type === "withdraw").reduce((a, t) => a + t.amount, 0);

  const submit = () => {
    const n = Number(amt);
    const minimum = open === "deposit" ? 5000 : 10000;
    if (!n || n < minimum) return toast.error(`Minimum ${open} is MMK ${minimum.toLocaleString()}`);
    const paymentAccount = selectedAccount || acct;
    if (open === "deposit") { s.deposit(n, method, paymentAccount); toast.success(`Deposit request for ${money(n)} submitted for review`); }
    else {
      if (paymentAccount.length < 6) return toast.error("Select or enter your account number");
      if (!s.withdraw(n, method, paymentAccount)) return toast.error("Insufficient balance");
      toast.success(`Withdrawal request for ${money(n)} submitted for review`);
    }
    setAmt(""); setOpen(null);
  };

  return (
    <AppShell title="Wallet">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-red p-5 shadow-red text-primary-foreground">
          <p className="text-sm opacity-80">Total balance</p>
          <p className="font-display text-4xl font-bold">{money(s.balance)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs opacity-90"><span>Total deposit: {money(dep)}</span><span className="text-right">Total withdraw: {money(wd)}</span></div>
        </div>
        <section className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-bold">My payment accounts</h2><p className="text-xs text-muted-foreground">Save KPay or Wave Pay details for faster requests.</p></div>
            <button onClick={() => { setAccountDraft(s.paymentAccounts); setEditingAccounts((v) => !v); }} className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold"><Pencil className="h-3.5 w-3.5" />{editingAccounts ? "Close" : "Edit"}</button>
          </div>
          {!editingAccounts && <div className="mt-3 grid gap-2 text-sm"><p><span className="font-semibold">KPay:</span> {s.paymentAccounts.kpayPhone ? `${s.paymentAccounts.kpayPhone} · ${s.paymentAccounts.kpayName}` : "Not added"}</p><p><span className="font-semibold">Wave Pay:</span> {s.paymentAccounts.wavePhone ? `${s.paymentAccounts.wavePhone} · ${s.paymentAccounts.waveName}` : "Not added"}</p></div>}
          {editingAccounts && <div className="mt-3 grid gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">KPay</p><div className="grid grid-cols-2 gap-2"><input value={accountDraft.kpayPhone} onChange={(e) => setAccountDraft({ ...accountDraft, kpayPhone: e.target.value })} placeholder="Phone number" className={inputCls} /><input value={accountDraft.kpayName} onChange={(e) => setAccountDraft({ ...accountDraft, kpayName: e.target.value })} placeholder="Account name" className={inputCls} /></div>
            <p className="pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Wave Pay</p><div className="grid grid-cols-2 gap-2"><input value={accountDraft.wavePhone} onChange={(e) => setAccountDraft({ ...accountDraft, wavePhone: e.target.value })} placeholder="Phone number" className={inputCls} /><input value={accountDraft.waveName} onChange={(e) => setAccountDraft({ ...accountDraft, waveName: e.target.value })} placeholder="Account name" className={inputCls} /></div>
            <button onClick={() => { s.savePaymentAccounts(accountDraft); setEditingAccounts(false); toast.success("Payment accounts saved"); }} className={btnPrimary}>Save accounts</button>
          </div>}
        </section>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setOpen("deposit")} className="flex flex-col items-center gap-1 rounded-2xl bg-card py-4 font-semibold"><Plus className="h-6 w-6 text-primary" />Deposit</button>
          <button onClick={() => setOpen("withdraw")} className="flex flex-col items-center gap-1 rounded-2xl bg-card py-4 font-semibold"><ArrowUpRight className="h-6 w-6 text-primary" />Withdraw</button>
        </div>
        <h2 className="text-lg font-bold">Transaction history</h2>
        <div className="grid grid-cols-4 gap-1.5">
          {(["all", "deposit", "withdraw", "game"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg py-1.5 text-xs font-semibold capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{f}</button>
          ))}
        </div>
        <TxList txs={txs} />
      </div>

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title={open === "deposit" ? "Deposit" : "Withdraw"}>
        <div className="space-y-3">
          {open === "deposit" ? (
            <>
            {(s.paymentAccounts.kpayPhone || s.paymentAccounts.wavePhone || s.paymentAccounts.qrCode) && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-xs font-bold uppercase tracking-wider text-primary">Transfer to</p><div className="mt-2 flex flex-col gap-2 text-sm">{s.paymentAccounts.kpayPhone && <p><span className="font-semibold">KPay:</span> {s.paymentAccounts.kpayPhone} · {s.paymentAccounts.kpayName}</p>}{s.paymentAccounts.wavePhone && <p><span className="font-semibold">Wave Pay:</span> {s.paymentAccounts.wavePhone} · {s.paymentAccounts.waveName}</p>}{s.paymentAccounts.qrCode && <img src={s.paymentAccounts.qrCode} alt="Admin deposit QR code" className="mt-1 max-h-40 rounded-lg object-contain" />}</div><p className="mt-2 text-xs text-muted-foreground">Send the amount first, then submit your request below for manual review.</p></div>}
            <div className="grid grid-cols-2 gap-2">{METHODS.map((m) => (
              <button key={m} onClick={() => setMethod(m)} className={`rounded-lg py-2 text-sm font-semibold ${method === m ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{m}</button>
            ))}            </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Withdrawable: {money(s.balance)}</p>
              {(s.paymentAccounts.kpayPhone || s.paymentAccounts.wavePhone) && <div className="grid gap-2"><p className="text-xs font-semibold text-muted-foreground">Select a saved account</p>{[s.paymentAccounts.kpayPhone && { method: "KPay", value: s.paymentAccounts.kpayPhone, label: `${s.paymentAccounts.kpayPhone} · ${s.paymentAccounts.kpayName}` }, s.paymentAccounts.wavePhone && { method: "Wave Pay", value: s.paymentAccounts.wavePhone, label: `${s.paymentAccounts.wavePhone} · ${s.paymentAccounts.waveName}` }].filter(Boolean).map((a) => a && <button key={a.method} onClick={() => { setMethod(a.method); setSelectedAccount(a.value); setAcct(a.value); }} className={`rounded-lg border px-3 py-2 text-left text-sm ${selectedAccount === a.value ? "border-primary bg-primary/10" : "border-border bg-background"}`}><span className="font-semibold">{a.method}</span><span className="block text-xs text-muted-foreground">{a.label}</span></button>)}</div>}
              <input value={acct} onChange={(e) => { setAcct(e.target.value); setSelectedAccount(""); }} placeholder="Bank / wallet account number" className={inputCls} />
            </>
          )}
          <input inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} placeholder={`Amount (min MMK ${open === "deposit" ? "5,000" : "10,000"})`} className={inputCls} />
          <div className="grid grid-cols-4 gap-2">{(open === "deposit" ? [5000, 10000, 20000, 50000] : [10000, 20000, 50000, 100000]).map((v) => (
            <button key={v} onClick={() => setAmt(String(v))} className="rounded-lg bg-secondary py-2 text-sm font-semibold">{v}</button>
          ))}</div>
          <button className={btnPrimary} onClick={submit}>{open === "deposit" ? "Deposit now" : "Withdraw now"}</button>
          <p className="text-center text-xs text-muted-foreground">Simulation only — no real payment is processed.</p>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
