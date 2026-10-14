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

const METHODS = ["KPay", "Wave Pay"];

function WalletPage() {
  const s = useStore();
  const { action } = Route.useSearch();
  const [open, setOpen] = useState<"deposit" | "withdraw" | null>(null);
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [acct, setAcct] = useState("");
  const [acctName, setAcctName] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [receiptImage, setReceiptImage] = useState("");
  const [referenceLast5, setReferenceLast5] = useState("");
  const [depositStep, setDepositStep] = useState<1 | 2>(1);
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
    if (open === "deposit") {
      if (!receiptImage && !/^\d{5}$/.test(referenceLast5)) return toast.error("Upload a receipt or enter the last 5 reference digits");
      s.deposit(n, method, paymentAccount, acctName, receiptImage, referenceLast5);
      toast.success(`Deposit request for ${money(n)} submitted for review`);
    }
    else {
      if (paymentAccount.length < 6) return toast.error("Select or enter your account number");
      if (!s.withdraw(n, method, paymentAccount, acctName)) return toast.error("Insufficient balance");
      toast.success(`Withdrawal request for ${money(n)} submitted for review`);
    }
    setAmt(""); setAcct(""); setAcctName(""); setReceiptImage(""); setReferenceLast5(""); setDepositStep(1); setOpen(null);
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
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground"><span className={depositStep === 1 ? "text-primary" : ""}>1. Deposit details</span><span className={depositStep === 2 ? "text-primary" : ""}>2. Confirm transfer</span></div>
              {depositStep === 1 ? <>
                <div className="grid grid-cols-2 gap-2">{METHODS.map((m) => <button key={m} onClick={() => setMethod(m)} className={`rounded-lg py-2 text-sm font-semibold ${method === m ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{m}</button>)}</div>
                <p className="text-sm font-semibold">Your sending account</p>
                <div className="grid grid-cols-2 gap-2"><input value={acct} onChange={(e) => { setAcct(e.target.value); setSelectedAccount(""); }} placeholder={`Your ${method} phone number`} className={inputCls} /><input value={acctName} onChange={(e) => setAcctName(e.target.value)} placeholder="Your account name" className={inputCls} /></div>
                {(method === "KPay" ? s.paymentAccounts.kpayPhone : s.paymentAccounts.wavePhone) && <button onClick={() => { const phone = method === "KPay" ? s.paymentAccounts.kpayPhone : s.paymentAccounts.wavePhone; setAcct(phone); setAcctName(method === "KPay" ? s.paymentAccounts.kpayName : s.paymentAccounts.waveName); setSelectedAccount(phone); }} className="text-left text-xs text-primary">Use saved {method} account</button>}
                <input inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\\D/g, ""))} placeholder="Amount (min MMK 5,000)" className={inputCls} />
                <div className="grid grid-cols-4 gap-2">{[5000, 10000, 20000, 50000].map((v) => <button key={v} onClick={() => setAmt(String(v))} className="rounded-lg bg-secondary py-2 text-sm font-semibold">{v}</button>)}</div>
                <button className={btnPrimary} onClick={() => { const n = Number(amt); if (!n || n < 5000) return toast.error("Minimum deposit is MMK 5,000"); if (acct.length < 6) return toast.error("Enter your sending phone number"); setDepositStep(2); }}>Continue to transfer details</button>
              </> : <>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><p className="font-semibold">Send {money(Number(amt))} to admin {method}</p><p className="mt-1 text-muted-foreground">{method === "KPay" ? (s.paymentAccounts.kpayPhone ? `${s.paymentAccounts.kpayPhone} · ${s.paymentAccounts.kpayName}` : "Admin has not configured a KPay account") : (s.paymentAccounts.wavePhone ? `${s.paymentAccounts.wavePhone} · ${s.paymentAccounts.waveName}` : "Admin has not configured a Wave Pay account")}</p></div>
                <label className="block cursor-pointer rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-sm font-semibold text-primary hover:bg-primary/10">Upload transfer receipt <span className="block text-xs font-normal text-muted-foreground">Optional when you provide the last 5 digits</span><input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setReceiptImage(String(reader.result)); reader.readAsDataURL(file); }} className="sr-only" />{receiptImage && <span className="mt-2 block text-xs text-win-green">Receipt attached</span>}</label>
                <input inputMode="numeric" maxLength={5} value={referenceLast5} onChange={(e) => setReferenceLast5(e.target.value.replace(/\\D/g, "").slice(0, 5))} placeholder="Last 5 transaction digits (optional)" className={inputCls} />
                <div className="grid grid-cols-2 gap-2"><button className="rounded-xl bg-secondary py-3 font-semibold" onClick={() => setDepositStep(1)}>Back</button><button className={btnPrimary} onClick={submit}>Confirm Deposit Request</button></div>
              </>}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Withdrawable: {money(s.balance)}</p>
              {(s.paymentAccounts.kpayPhone || s.paymentAccounts.wavePhone) && <div className="grid gap-2"><p className="text-xs font-semibold text-muted-foreground">Select a saved account</p>{[s.paymentAccounts.kpayPhone && { method: "KPay", value: s.paymentAccounts.kpayPhone, label: `${s.paymentAccounts.kpayPhone} · ${s.paymentAccounts.kpayName}` }, s.paymentAccounts.wavePhone && { method: "Wave Pay", value: s.paymentAccounts.wavePhone, label: `${s.paymentAccounts.wavePhone} · ${s.paymentAccounts.waveName}` }].filter(Boolean).map((a) => a && <button key={a.method} onClick={() => { setMethod(a.method); setSelectedAccount(a.value); setAcct(a.value); }} className={`rounded-lg border px-3 py-2 text-left text-sm ${selectedAccount === a.value ? "border-primary bg-primary/10" : "border-border bg-background"}`}><span className="font-semibold">{a.method}</span><span className="block text-xs text-muted-foreground">{a.label}</span></button>)}</div>}
              <div className="grid grid-cols-2 gap-2"><input value={acct} onChange={(e) => { setAcct(e.target.value); setSelectedAccount(""); }} placeholder="Your KPay/Wave phone number" className={inputCls} /><input value={acctName} onChange={(e) => setAcctName(e.target.value)} placeholder="Your account name" className={inputCls} /></div>
            </>
          )}
          {open === "withdraw" && <>
            <input inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} placeholder="Amount (min MMK 10,000)" className={inputCls} />
            <div className="grid grid-cols-4 gap-2">{[10000, 20000, 50000, 100000].map((v) => <button key={v} onClick={() => setAmt(String(v))} className="rounded-lg bg-secondary py-2 text-sm font-semibold">{v}</button>)}</div>
            <button className={btnPrimary} onClick={submit}>Withdraw now</button>
          </>}
        </div>
      </BottomSheet>
    </AppShell>
  );
}
