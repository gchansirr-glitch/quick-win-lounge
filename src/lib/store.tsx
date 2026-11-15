import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MarketId, Side } from "./market";
import { supabase, signOutShared } from "./supabase";
type GameKind = MarketId;

export type Tx = { id: string; type: "deposit" | "withdraw" | "bet" | "win" | "bonus" | "commission" | "vault"; amount: number; at: number; note: string };
export type VipLevel = { level: number; name: string; wagerRequired: number; commissionPercent: number; upgradeBonus: number; monthlyBonus: number };
export type CashRequest = { id: string; type: "deposit" | "withdraw"; amount: number; method: string; account?: string; accountName?: string; userEmail?: string; receiptImage?: string; referenceLast5?: string; status: "pending" | "approved" | "rejected"; at: number };
export type Bet = { id: string; kind: MarketId; dur: number; period: number; sel: Side; odds: number; target: number; amount: number; at: number; settled?: boolean; won?: number; result?: Side };
export type UserRole = "user" | "sub-admin" | "affiliate-agent" | "super-admin";
export type User = { email: string; phone?: string; uid: string; authId?: string; inviteCode: string; lastLoginAt?: number; isAdmin: boolean; role: UserRole };

const isValidPublicUid = (value: unknown): value is string => typeof value === "string" && /^\d{8}$/.test(value);
const createUniquePublicUid = (users: User[], preferred?: unknown) => {
  const used = new Set(users.map((user) => user.uid));
  if (isValidPublicUid(preferred) && !used.has(preferred)) return preferred;
  let candidate = "";
  do { candidate = String(Math.floor(10_000_000 + Math.random() * 90_000_000)); } while (used.has(candidate));
  return candidate;
};
const mapDatabaseRole = (role: string): UserRole => role === "super_admin" ? "super-admin" : role === "admin" || role === "sub_admin" ? "sub-admin" : role === "affiliate_agent" ? "affiliate-agent" : "user";
export type PaymentAccount = { kpayPhone: string; kpayName: string; wavePhone: string; waveName: string; qrCode: string };

type State = {
  user: User | null;
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
  lang: "en" | "my";
};

const initial: State = { user: null, paymentAccounts: { kpayPhone: "", kpayName: "", wavePhone: "", waveName: "", qrCode: "" }, balance: 0, vault: 0, txs: [], bets: [], lastCheckIn: null, streak: 0, redeemed: [], marketOverride: null, marketOverrides: {}, requests: [], profiles: {}, persistSession: true, vipLevels: Array.from({ length: 6 }, (_, index) => ({ level: index, name: index === 0 ? "Starter" : `VIP ${index}`, wagerRequired: index * 10000, commissionPercent: index * 0.5, upgradeBonus: index * 1000, monthlyBonus: index * 500 })), referralCode: "", referredCount: 0, lang: "en" };
const KEY = "tp-lottery-v1";
const SESSION_KEY = "tp-lottery-session-v1";
const profileKeys = ["balance", "vault", "txs", "bets", "lastCheckIn", "streak", "redeemed", "requests"] as const;
const uid = () => Math.random().toString(36).slice(2, 10);
const persistableState = (state: State): State => ({ ...state, user: state.user ? { ...state.user, role: "user", isAdmin: false } : null, profiles: state.user ? { [state.user.email || state.user.phone || state.user.uid]: state.profiles[state.user.email || state.user.phone || state.user.uid] } : {} });

type Ctx = State & {
  ready: boolean;
  login: (identity: string, remember?: boolean, authId?: string, authProfile?: { id?: string; role?: string; balance?: number; referral_code?: string; user_code?: string; welcome_bonus?: number }, phone?: string) => void;
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
  commission: (amt: number, note: string) => void;
  checkIn: () => number | null;
  redeem: (code: string) => number | null;
  moveVault: (amt: number, toVault: boolean) => boolean;
  saveVipLevels: (levels: VipLevel[]) => void;
  setLanguage: (lang: "en" | "my") => void;
};

const C = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | undefined;
    let roleChannel: ReturnType<NonNullable<typeof supabase>["channel"]> | undefined;
    const restore = async () => {
      try {
        const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const savedState = JSON.parse(raw);
          delete savedState.registeredUsers;
          delete savedState.subAdminEmails;
          const restored = { ...initial, ...savedState } as State;
          if (restored.user) {
            restored.user = { ...restored.user, role: "user", isAdmin: false };
            const oldUid = typeof restored.user.uid === "string" ? restored.user.uid : "";
            const publicUid = isValidPublicUid(oldUid) ? oldUid : createUniquePublicUid([]);
            restored.user = { ...restored.user, uid: publicUid, authId: restored.user.authId ?? (oldUid.includes("-") ? oldUid : undefined), inviteCode: restored.user.inviteCode || publicUid, lastLoginAt: restored.user.lastLoginAt ?? Date.now() };
          }
          setS(restored);
        }
      } catch {}
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const authUser = data.session?.user;
        if (authUser) {
          const { data: profile } = await (supabase as any).from("profiles").select("id,email,role,balance,referral_code,user_code").eq("id", authUser.id).maybeSingle();
          const { data: assignedRoles } = await (supabase as any).from("user_roles").select("role").eq("user_id", authUser.id).in("role", ["admin", "sub_admin", "super_admin"]);
          if (profile) {
            let publicUid = profile.user_code;
            let referralCode = profile.referral_code;
            if (!isValidPublicUid(publicUid)) {
              const { data: ensured } = await (supabase as any).rpc("ensure_my_public_id");
              const ensuredRow = Array.isArray(ensured) ? ensured[0] : ensured;
              publicUid = isValidPublicUid(ensuredRow?.user_code) ? ensuredRow.user_code : createUniquePublicUid([]);
              referralCode = ensuredRow?.referral_code || publicUid;
            }
            const role = (assignedRoles ?? []).some((item: { role: string }) => item.role === "super_admin") ? "super_admin" : (assignedRoles ?? []).some((item: { role: string }) => item.role === "admin") ? "admin" : (assignedRoles ?? []).some((item: { role: string }) => item.role === "sub_admin") ? "sub_admin" : "user";
            const mappedRole = mapDatabaseRole(role);
            setS((p) => ({ ...p, user: { email: authUser.email ?? "", phone: authUser.phone ?? undefined, uid: publicUid, authId: authUser.id, inviteCode: referralCode || publicUid, lastLoginAt: authUser.last_sign_in_at ? Date.parse(authUser.last_sign_in_at) : Date.now(), isAdmin: mappedRole !== "user", role: mappedRole }, balance: Number(profile.balance ?? p.balance) }));
          }
          channel = supabase.channel(`profile-sync:${authUser.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${authUser.id}` }, (payload) => setS((p) => ({ ...p, balance: Number((payload.new as { balance?: number }).balance ?? p.balance) }))).subscribe();
          roleChannel = supabase.channel(`role-sync:${authUser.id}`).on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${authUser.id}` }, async () => {
            const { data: nextRoles } = await (supabase as any).from("user_roles").select("role").eq("user_id", authUser.id).in("role", ["admin", "sub_admin", "super_admin"]);
            const roleValue = (nextRoles ?? []).some((item: { role: string }) => item.role === "super_admin") ? "super_admin" : (nextRoles ?? []).some((item: { role: string }) => item.role === "admin") ? "admin" : (nextRoles ?? []).some((item: { role: string }) => item.role === "sub_admin") ? "sub_admin" : "user";
            const role = mapDatabaseRole(roleValue);
            setS((p) => p.user?.authId === authUser.id ? { ...p, user: { ...p.user, role, isAdmin: role !== "user" } } : p);
          }).subscribe();
        }
      }
      setReady(true);
    };
    void restore();
    return () => { if (channel) void channel.unsubscribe(); if (roleChannel) void roleChannel.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(persistableState(s));
    if (s.persistSession) localStorage.setItem(KEY, serialized);
    else localStorage.removeItem(KEY);
    if (s.user) sessionStorage.setItem(SESSION_KEY, serialized);
  }, [s, ready]);

  const tx = (type: Tx["type"], amount: number, note: string): Tx => ({ id: uid(), type, amount, note, at: Date.now() });

  const api: Ctx = {
    ...s, ready,
    login: (identity, remember = true, authId, authProfile, suppliedPhone) => setS((p) => {
      const normalized = identity.trim().toLowerCase();
      const isEmail = /^\S+@\S+\.\S+$/.test(normalized);
      const phone = suppliedPhone ?? (!isEmail ? normalized : undefined);
      const existing = undefined;
      const profileRole: UserRole | undefined = authProfile?.role === "super_admin" ? "super-admin" : authProfile?.role === "admin" || authProfile?.role === "sub_admin" ? "sub-admin" : authProfile?.role === "affiliate_agent" ? "affiliate-agent" : undefined;
      const role: UserRole = profileRole ?? "user";
      const publicUid = createUniquePublicUid([], authProfile?.user_code);
      const inviteCode = authProfile?.referral_code || existing?.inviteCode || publicUid;
      const account: User = { email: isEmail ? normalized : "", phone, uid: publicUid, authId, inviteCode, lastLoginAt: Date.now(), isAdmin: role !== "user", role };
      const profiles = { ...p.profiles };
      if (p.user) profiles[p.user.email || p.user.phone || p.user.uid] = Object.fromEntries(profileKeys.map((key) => [key, p[key]])) as State["profiles"][string];
      const saved = profiles[normalized];
      const profile = saved ?? { balance: Number(authProfile?.balance ?? 0), vault: 0, txs: authProfile?.welcome_bonus ? [tx("bonus", authProfile.welcome_bonus, "Welcome bonus")] : [], bets: [], lastCheckIn: null, streak: 0, redeemed: [], requests: [] };
      const next = { ...p, ...profile, profiles, persistSession: remember, paymentAccounts: p.paymentAccounts, user: account };
      if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify(persistableState(next)));
      return next;
    }),
    logout: () => setS((p) => {
      if (!p.user) return p;
      const profiles = { ...p.profiles, [p.user.email || p.user.phone || p.user.uid]: Object.fromEntries(profileKeys.map((key) => [key, p[key]])) as State["profiles"][string] };
      sessionStorage.removeItem(SESSION_KEY);
      void signOutShared();
      return { ...p, profiles, user: null };
    }),
    setMarketOverride: (side) => setS((p) => ({ ...p, marketOverride: side })),
    setMarketDirection: (market, side) => setS((p) => ({ ...p, marketOverrides: { ...p.marketOverrides, ...(side ? { [market]: side } : (() => { const next = { ...p.marketOverrides }; delete next[market]; return next; })()) } })),
    savePaymentAccounts: (accounts) => setS((p) => ({ ...p, paymentAccounts: accounts })),
    saveVipLevels: (levels) => setS((p) => s.user?.role === "super-admin" || s.user?.role === "sub-admin" ? ({ ...p, vipLevels: levels }) : p),
    setLanguage: (lang) => setS((p) => ({ ...p, lang })),

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
      const due = s.bets.filter((b) => !b.settled && b.kind === kind && b.dur === dur && b.period === period);
      if (!due.length) return 0;
      due.forEach((b) => (total += calc(b)));
      setS((p) => {
        let win = 0;
        const bets = p.bets.map((b) => {
          if (b.settled || b.kind !== kind || b.dur !== dur || b.period !== period) return b;
          const w = calc(b); win += w;
          return { ...b, settled: true, won: w, result };
        });
        return { ...p, bets, balance: p.balance + win, txs: win ? [tx("win", win, "Game winnings"), ...p.txs] : p.txs };
      });
      return total;
    },
    bonus: (amt, note) => setS((p) => ({ ...p, balance: p.balance + amt, txs: [tx("bonus", amt, note), ...p.txs] })),
    commission: (amt, note) => setS((p) => ({ ...p, balance: p.balance + amt, txs: [tx("commission", amt, note), ...p.txs] })),
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
