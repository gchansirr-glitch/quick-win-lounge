import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MarketId, Side } from "./market";
type GameKind = MarketId;

export type Tx = { id: string; type: "deposit" | "withdraw" | "bet" | "win" | "bonus" | "vault"; amount: number; at: number; note: string };
export type CashRequest = { id: string; type: "deposit" | "withdraw"; amount: number; method: string; account?: string; receiptImage?: string; referenceLast5?: string; status: "pending" | "approved" | "rejected"; at: number };
export type Bet = { id: string; kind: MarketId; dur: number; period: number; sel: Side; odds: number; target: number; amount: number; at: number; settled?: boolean; won?: number; result?: Side };
export type User = { email: string; uid: string; inviteCode: string; isAdmin: boolean };
export type PaymentAccount = { kpayPhone: string; kpayName: string; wavePhone: string; waveName: string; qrCode: string };

type State = {
  user: User | null;
  registeredUsers: User[];
  paymentAccounts: PaymentAccount;
  balance: number;
  vault: number;
  txs: Tx[];
  bets: Bet[];
  lastCheckIn: string | null;
  streak: number;
  redeemed: string[];
  marketOverride: Side | null;
  marketOverrides: Partial<Record<MarketId, Side>>;
  requests: CashRequest[];
};

const initial: State = { user: null, registeredUsers: [], paymentAccounts: { kpayPhone: "", kpayName: "", wavePhone: "", waveName: "", qrCode: "" }, balance: 0, vault: 0, txs: [], bets: [], lastCheckIn: null, streak: 0, redeemed: [], marketOverride: null, marketOverrides: {}, requests: [] };
const KEY = "tp-lottery-v1";
const uid = () => Math.random().toString(36).slice(2, 10);

type Ctx = State & {
  ready: boolean;
  login: (email: string) => void;
  logout: () => void;
  setMarketOverride: (side: Side | null) => void;
  setMarketDirection: (market: MarketId, side: Side | null) => void;
  savePaymentAccounts: (accounts: PaymentAccount) => void;
  deposit: (amt: number, method: string, account?: string, receiptImage?: string, referenceLast5?: string) => void;
  withdraw: (amt: number, method: string, account: string) => boolean;
  reviewRequest: (id: string, status: "approved" | "rejected") => void;
  placeBet: (b: Omit<Bet, "id" | "at">) => boolean;
  settle: (kind: GameKind, dur: number, period: number, result: Side, calc: (b: Bet) => number) => number;
  bonus: (amt: number, note: string) => void;
  checkIn: () => number | null;
  redeem: (code: string) => number | null;
  moveVault: (amt: number, toVault: boolean) => boolean;
};

const C = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setS({ ...initial, ...JSON.parse(raw) }); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(s)); }, [s, ready]);

  const tx = (type: Tx["type"], amount: number, note: string): Tx => ({ id: uid(), type, amount, note, at: Date.now() });

  const api: Ctx = {
    ...s, ready,
    login: (email) => setS((p) => {
      const existing = p.registeredUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const account = existing ?? { email, uid: String(100000 + (Math.random() * 900000) | 0), inviteCode: uid().toUpperCase().slice(0, 7), isAdmin: email.toLowerCase() === "acagaming75@gmail.com" };
      return p.user?.email === email ? p : { ...initial, registeredUsers: existing ? p.registeredUsers : [...p.registeredUsers, account], paymentAccounts: p.paymentAccounts, user: account, balance: 1000, txs: [tx("bonus", 1000, "Welcome bonus")] };
    }),
    logout: () => setS((p) => ({ ...p, user: null })),
    setMarketOverride: (side) => setS((p) => ({ ...p, marketOverride: side })),
    setMarketDirection: (market, side) => setS((p) => ({ ...p, marketOverrides: { ...p.marketOverrides, ...(side ? { [market]: side } : (() => { const next = { ...p.marketOverrides }; delete next[market]; return next; })()) } })),
    savePaymentAccounts: (accounts) => setS((p) => ({ ...p, paymentAccounts: accounts })),
    deposit: (amt, method, account, receiptImage, referenceLast5) => setS((p) => ({ ...p, requests: [{ id: uid(), type: "deposit", amount: amt, method, account, receiptImage, referenceLast5, status: "pending", at: Date.now() }, ...p.requests] })),
    withdraw: (amt, method, account) => {
      if (amt > s.balance) return false;
      setS((p) => ({ ...p, requests: [{ id: uid(), type: "withdraw", amount: amt, method, account, status: "pending", at: Date.now() }, ...p.requests] }));
      return true;
    },
    reviewRequest: (id, status) => setS((p) => {
      const request = p.requests.find((r) => r.id === id);
      if (!request || request.status !== "pending") return p;
      const approved = status === "approved";
      const delta = approved ? (request.type === "deposit" ? request.amount : -request.amount) : 0;
      return { ...p, balance: p.balance + delta, requests: p.requests.map((r) => r.id === id ? { ...r, status } : r), txs: approved ? [tx(request.type, request.type === "deposit" ? request.amount : -request.amount, `${request.method} approved`), ...p.txs] : p.txs };
    }),
    placeBet: (b) => {
      if (b.amount > s.balance) return false;
      setS((p) => ({ ...p, balance: p.balance - b.amount, bets: [{ ...b, id: uid(), at: Date.now() }, ...p.bets].slice(0, 200), txs: [tx("bet", -b.amount, `${b.kind === "trx" ? "TRX " : ""}Win Go bet`), ...p.txs] }));
      return true;
    },
    settle: (kind, dur, period, result, calc) => {
      let total = 0;
      const due = s.bets.filter((b) => !b.settled && b.kind === kind && b.dur === dur && b.period <= period);
      if (!due.length) return 0;
      due.forEach((b) => (total += calc(b)));
      setS((p) => {
        let win = 0;
        const bets = p.bets.map((b) => {
          if (b.settled || b.kind !== kind || b.dur !== dur || b.period > period) return b;
          const w = calc(b); win += w;
          return { ...b, settled: true, won: w, result };
        });
        return { ...p, bets, balance: p.balance + win, txs: win ? [tx("win", win, "Game winnings"), ...p.txs] : p.txs };
      });
      return total;
    },
    bonus: (amt, note) => setS((p) => ({ ...p, balance: p.balance + amt, txs: [tx("bonus", amt, note), ...p.txs] })),
    checkIn: () => {
      const today = new Date().toDateString();
      if (s.lastCheckIn === today) return null;
      const y = new Date(Date.now() - 864e5).toDateString();
      const streak = s.lastCheckIn === y ? (s.streak % 7) + 1 : 1;
      const amt = streak * 5;
      setS((p) => ({ ...p, lastCheckIn: today, streak, balance: p.balance + amt, txs: [tx("bonus", amt, `Day ${streak} sign-in`), ...p.txs] }));
      return amt;
    },
    redeem: (code) => {
      const c = code.trim().toUpperCase();
      const codes: Record<string, number> = { TPWELCOME: 50, LUCKY88: 88, REDHOT: 20 };
      if (!codes[c] || s.redeemed.includes(c)) return null;
      setS((p) => ({ ...p, redeemed: [...p.redeemed, c], balance: p.balance + codes[c], txs: [tx("bonus", codes[c], `Gift code ${c}`), ...p.txs] }));
      return codes[c];
    },
    moveVault: (amt, toVault) => {
      if (toVault ? amt > s.balance : amt > s.vault) return false;
      setS((p) => ({ ...p, balance: p.balance + (toVault ? -amt : amt), vault: p.vault + (toVault ? amt : -amt), txs: [tx("vault", toVault ? -amt : amt, toVault ? "To safe vault" : "From safe vault"), ...p.txs] }));
      return true;
    },
  };
  return <C.Provider value={api}>{children}</C.Provider>;
}

export function useStore() {
  const c = useContext(C);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
export const money = (n: number) => `MMK ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
