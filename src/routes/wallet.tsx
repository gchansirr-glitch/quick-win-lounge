import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, ArrowUpRight } from "lucide-react";
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

const METHODS = ["KBZ Pay", "Wave Pay", "UPI", "USDT TRC20"];

function WalletPage() {
  const s = useStore();
  const { action } = Route.useSearch();
  const [open, setOpen] = useState<"deposit" | "withdraw" | null>(null);
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [acct, setAcct] = useState("");
  const [filter, setFilter] = useState<"all" | "deposit" | "withdraw" | "game">("all");
  useEffect(() => { if (action) setOpen(action); }, [action]);

  const txs = s.txs.filter((t) => filter === "all" || (filter === "game" ? t.type === "bet" || t.type === "win" : t.type === filter)).slice(0, 50);
  const dep = s.txs.filter((t) => t.type === "deposit").reduce((a, t) => a + t.amount, 0);
  const wd = -s.txs.filter((t) => t.type === "withdraw").reduce((a, t) => a + t.amount, 0);

  const submit = () => {
    const n = Number(amt);
    if (!n || n < 100) return toast.error("Minimum amount is MMK 100");
    if (open === "deposit") { s.deposit(n, `${method} deposit`); toast.success(`Deposited ${money(n)}`); }
    else {
      if (acct.length < 6) return toast.error("Enter your account number");
      if (!s.withdraw(n)) return toast.error("Insufficient balance");
      toast.success(`Withdrawal of ${money(n)} submitted`);
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
            <div className="grid grid-cols-2 gap-2">{METHODS.map((m) => (
              <button key={m} onClick={() => setMethod(m)} className={`rounded-lg py-2 text-sm font-semibold ${method === m ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{m}</button>
            ))}</div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Withdrawable: {money(s.balance)}</p>
              <input value={acct} onChange={(e) => setAcct(e.target.value)} placeholder="Bank / wallet account number" className={inputCls} />
            </>
          )}
          <input inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} placeholder="Amount (min MMK 100)" className={inputCls} />
          <div className="grid grid-cols-4 gap-2">{[100, 500, 1000, 5000].map((v) => (
            <button key={v} onClick={() => setAmt(String(v))} className="rounded-lg bg-secondary py-2 text-sm font-semibold">{v}</button>
          ))}</div>
          <button className={btnPrimary} onClick={submit}>{open === "deposit" ? "Deposit now" : "Withdraw now"}</button>
          <p className="text-center text-xs text-muted-foreground">Simulation only — no real payment is processed.</p>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
