import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MarketId, Side } from "./market";
import { supabase, signOutShared } from "./supabase";
type GameKind = MarketId;

export type Tx = { id: string; type: "deposit" | "withdraw" | "bet" | "win" | "bonus" | "commission" | "vault"; amount: number; at: number; note: string };
export type VipLevel = { level: number; name: string; wagerRequired: number; commissionPercent: number; upgradeBonus: number; monthlyBonus: number };
export type CashRequest = { id: string; type: "deposit" | "withdraw"; amount: number; method: string; account?: string; accountName?: string; userEmail?: string; receiptImage?: string; referenceLast5?: string; status: "pending" | "approved" | "rejected"; at: number };
export type Bet = { id: string; kind: MarketId; dur: number; period: number; sel: Side; odds: number; target: number; amount: number; at: number; settled?: boolean; won?: number; result?: Side };
export type UserRole = "user" | "sub-admin" | "super-admin";
export const SUPER_ADMIN_EMAIL = "acagaming75@gmail.com";
export type User = { email: string; uid: string; inviteCode: string; isAdmin: boolean; role: UserRole };
export type PaymentAccount = { kpayPhone: string; kpayName: string; wavePhone: string; waveName: string; qrCode: string };

type State = {
  user: User | null;
  registeredUsers: User[];
  subAdminEmails: string[];
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
  profiles: Record<string, Pick<State, "balance" | "vault" | "txs" | "bets" | "lastCheckIn" | "streak" | "redeemed" | "requests">>;
  persistSession: boolean;
  vipLevels: VipLevel[];
  referralCode: string;
  referredCount: number;
};

const initial: State = { user: null, registeredUsers: [], subAdminEmails: [], paymentAccounts: { kpayPhone: "", kpayName: "", wavePhone: "", waveName: "", qrCode: "" }, balance: 0, vault: 0, txs: [], bets: [], lastCheckIn: null, streak: 0, redeemed: [], marketOverride: null, marketOverrides: {}, requests: [], profiles: {}, persistSession: true, vipLevels: Array.from({ length: 6 }, (_, index) => ({ level: index, name: index === 0 ? "Starter" : `VIP ${index}`, wagerRequired: index * 10000, commissionPercent: index * 0.5, upgradeBonus: index * 1000, monthlyBonus: index * 500 })), referralCode: "", referredCount: 0 };
const KEY = "tp-lottery-v1";
const SESSION_KEY = "tp-lottery-session-v1";
const profileKeys = ["balance", "vault", "txs", "bets", "lastCheckIn", "streak", "redeemed", "requests"] as const;
const uid = () => Math.random().toString(36).slice(2, 10);

type Ctx = State & {
  ready: boolean;
  login: (email: string, remember?: boolean, authId?: string) => void;
  logout: () => void;
  setMarketOverride: (side: Side | null) => void;
  setMarketDirection: (market: MarketId, side: Side | null) => void;
  savePaymentAccounts: (accounts: PaymentAccount) => void;
  deposit: (amt: number, method: string, account?: string, accountName?: string, receiptImage?: string, referenceLast5?: string) => void;
  withdraw: (amt: number, method: string, account: string, accountName?: string) => boolean;
  reviewRequest: (id: string, status: "approved" | "rejected") => void;
  placeBet: (b: Omit<Bet, "id" | "at">) => boolean;
  settle: (kind: GameKind, dur: number, period: number, result: Side, calc: (b: Bet) => number) => number;
  bonus: (amt: number, note: string) => void;
  checkIn: () => number | null;
  redeem: (code: string) => number | null;
  moveVault: (amt: number, toVault: boolean) => boolean;
  appointSubAdmin: (email: string) => boolean;
  removeSubAdmin: (email: string) => void;
  saveVipLevels: (levels: VipLevel[]) => void;
};

const C = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(SESSION_KEY);
      if (raw) setS({ ...initial, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || !s.user || !supabase) return;
    const syncProfile = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      await supabase.from("profiles").upsert({ id: authData.user.id, email: s.user?.email ?? authData.user.email ?? "", balance: s.balance, updated_at: new Date().toISOString() }, { onConflict: "id" });
    };
    void syncProfile();
  }, [ready, s.user?.email, s.balance]);
  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(s);
    if (s.persistSession) localStorage.setItem(KEY, serialized);
    else localStorage.removeItem(KEY);
    if (s.user) sessionStorage.setItem(SESSION_KEY, serialized);
  }, [s, ready]);

  const tx = (type: Tx["type"], amount: number, note: string): Tx => ({ id: uid(), type, amount, note, at: Date.now() });

  const api: Ctx = {
    ...s, ready,
    login: (email, remember = true) => setS((p) => {
      const normalized = email.trim().toLowerCase();
      const existing = p.registeredUsers.find((u) => u.email.toLowerCase() === normalized);
      const role: UserRole = normalized === SUPER_ADMIN_EMAIL ? "super-admin" : p.subAdminEmails.includes(normalized) ? "sub-admin" : "user";
      const account = existing ? { ...existing, email: normalized, role, isAdmin: role !== "user" } : { email: normalized, uid: String(100000 + (Math.random() * 900000) | 0), inviteCode: uid().toUpperCase().slice(0, 7), isAdmin: role !== "user", role };
      const profiles = { ...p.profiles };
      if (p.user) profiles[p.user.email] = Object.fromEntries(profileKeys.map((key) => [key, p[key]])) as State["profiles"][string];
      const saved = profiles[normalized];
      const firstLogin = !existing && !saved;
      const profile = saved ?? { balance: 1000, vault: 0, txs: firstLogin ? [tx("bonus", 1000, "Welcome bonus")] : [], bets: [], lastCheckIn: null, streak: 0, redeemed: [], requests: [] };
      const next = { ...p, ...profile, profiles, persistSession: remember, registeredUsers: existing ? p.registeredUsers.map((u) => u.email.toLowerCase() === normalized ? account : u) : [...p.registeredUsers, account], subAdminEmails: p.subAdminEmails, paymentAccounts: p.paymentAccounts, user: account };
      if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return next;
    }),
    logout: () => setS((p) => {
      if (!p.user) return p;
      const profiles = { ...p.profiles, [p.user.email]: Object.fromEntries(profileKeys.map((key) => [key, p[key]])) as State["profiles"][string] };
      sessionStorage.removeItem(SESSION_KEY);
      void signOutShared();
      return { ...p, profiles, user: null };
    }),
    appointSubAdmin: (email) => {
      const normalized = email.trim().toLowerCase();
      if (!normalized || normalized === SUPER_ADMIN_EMAIL || s.user?.role !== "super-admin") return false;
      setS((p) => ({ ...p, subAdminEmails: p.subAdminEmails.includes(normalized) ? p.subAdminEmails : [...p.subAdminEmails, normalized], registeredUsers: p.registeredUsers.map((u) => u.email.toLowerCase() === normalized ? { ...u, role: "sub-admin", isAdmin: true } : u) }));
      return true;
    },
    removeSubAdmin: (email) => setS((p) => s.user?.role === "super-admin" ? ({ ...p, subAdminEmails: p.subAdminEmails.filter((e) => e !== email.toLowerCase()), registeredUsers: p.registeredUsers.map((u) => u.email.toLowerCase() === email.toLowerCase() ? { ...u, role: "user", isAdmin: false } : u) }) : p),
    setMarketOverride: (side) => setS((p) => ({ ...p, marketOverride: side })),
    setMarketDirection: (market, side) => setS((p) => ({ ...p, marketOverrides: { ...p.marketOverrides, ...(side ? { [market]: side } : (() => { const next = { ...p.marketOverrides }; delete next[market]; return next; })()) } })),
    savePaymentAccounts: (accounts) => setS((p) => ({ ...p, paymentAccounts: accounts })),
    saveVipLevels: (levels) => setS((p) => s.user?.role === "super-admin" || s.user?.role === "sub-admin" ? ({ ...p, vipLevels: levels }) : p),
    deposit: (amt, method, account, accountName, receiptImage, referenceLast5) => setS((p) => ({ ...p, requests: [{ id: uid(), type: "deposit", amount: amt, method, account, accountName, userEmail: p.user?.email, receiptImage, referenceLast5, status: "pending", at: Date.now() }, ...p.requests] })),
    withdraw: (amt, method, account, accountName) => {
      if (amt > s.balance) return false;
      setS((p) => ({ ...p, requests: [{ id: uid(), type: "withdraw", amount: amt, method, account, accountName, userEmail: p.user?.email, status: "pending", at: Date.now() }, ...p.requests] }));
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
