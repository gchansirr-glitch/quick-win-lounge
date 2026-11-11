import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

const url = import.meta.env.VITE_SUPABASE_URL_2 ?? import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jegpxnoaimpmdekivtlw.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY_2 ?? import.meta.env.VITE_SUPABASE_JWT ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY_2 ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key
  ? createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

type LocalAuthRecord = { id: string; email: string; password: string; profile: { role: "super_admin" | "user"; balance: number; referral_code?: string } };
const LOCAL_AUTH_KEY = "tp-registered-users";

function localAuthRecords(): LocalAuthRecord[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY) ?? "[]") as LocalAuthRecord[]; } catch { return []; }
}

function saveLocalAuth(record: LocalAuthRecord) {
  const records = localAuthRecords().filter((item) => item.email !== record.email);
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify([...records, record]));
}

function fallbackAuthenticate(email: string, password: string, mode: "login" | "register", inviteCode: string) {
  const normalized = email.trim().toLowerCase();
  const role = normalized === "acagaming75@gmail.com" ? "super_admin" as const : "user" as const;
  const records = localAuthRecords();
  if (mode === "register") {
    if (records.some((record) => record.email === normalized)) throw new Error("An account with this email already exists");
    const account: LocalAuthRecord = { id: `usr_${Date.now()}`, email: normalized, password, profile: { role, balance: 1000, referral_code: inviteCode.trim().toUpperCase() } };
    saveLocalAuth(account);
    return account;
  }
  const account = records.find((record) => record.email === normalized && record.password === password);
  if (!account) throw new Error("Invalid email or password");
  const updated = { ...account, profile: { ...account.profile, role } };
  saveLocalAuth(updated);
  return updated;
}

export async function authenticate(email: string, password: string, mode: "login" | "register", inviteCode = "") {
  const normalized = email.trim().toLowerCase();
  if (supabase) {
    try {
      const isEmail = /^\S+@\S+\.\S+$/.test(normalized);
      const result = mode === "register"
        ? isEmail ? await supabase.auth.signUp({ email: normalized, password }) : await supabase.auth.signUp({ phone: normalized, password })
        : isEmail ? await supabase.auth.signInWithPassword({ email: normalized, password }) : await supabase.auth.signInWithPassword({ phone: normalized, password });
      if (!result.error && result.data.user) {
        const authUser = result.data.user;
        const role = normalized === "acagaming75@gmail.com" ? "super_admin" : "user";
        if (mode === "register") {
          let referrerId: string | null = null;
          if (inviteCode.trim()) {
            const { data: referrer } = await (supabase as any).from("profiles").select("id").eq("referral_code", inviteCode.trim().toUpperCase()).maybeSingle();
            referrerId = referrer?.id ?? null;
          }
          const ownInviteCode = `TP${authUser.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
          await (supabase as any).from("profiles").upsert({ id: authUser.id, email: isEmail ? normalized : `${normalized}@phone.local`, role, balance: 0, referred_by: referrerId, referral_code: ownInviteCode }, { onConflict: "id" });
          return { id: authUser.id, email: isEmail ? normalized : normalized, profile: { role, balance: 0, referral_code: ownInviteCode } };
        }
        const { data: profile } = await (supabase as any).from("profiles").select("role,balance,referral_code,user_code").eq("id", authUser.id).maybeSingle();
        return { id: authUser.id, email: normalized, profile: profile ?? { role, balance: 0 } };
      }
    } catch {
      // Fall through to the local session when Supabase is unavailable.
    }
  }
  return fallbackAuthenticate(normalized, password, mode, inviteCode);
}

export async function signOutShared() {
  await supabase?.auth.signOut();
}

export async function placeSharedBet(input: { roundId: string; marketId: string; side: "UP" | "DOWN"; amount: number }) {
  if (!supabase) return null;
  try {
    const { data, error } = await (supabase as any).rpc("place_bet", { p_round_id: input.roundId, p_market_id: input.marketId, p_side: input.side, p_amount: input.amount });
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function reviewSharedCashRequest(requestId: string, status: "approved" | "rejected") {
  if (!supabase) return null;
  const { data, error } = await (supabase as any).rpc("review_cash_request", { p_request_id: requestId, p_status: status });
  if (error) throw error;
  return data;
}

export async function allocateSharedAgentCredit(agentId: string, amount: number) {
  if (!supabase) return null;
  const { data, error } = await (supabase as any).rpc("allocate_agent_credit", { p_agent_id: agentId, p_amount: amount });
  if (error) throw error;
  return data;
}

export async function appointSharedAgent(email: string) {
  if (!supabase) return null;
  const { data, error } = await (supabase as any).rpc("appoint_affiliate_agent", { p_email: email });
  if (error) throw error;
  return data;
}

export async function saveSharedAgentSettings(agentId: string, settings: { turnover: number; deposit: number; welcome: number; creditLimit: number }) {
  if (!supabase) return null;
  const { data, error } = await (supabase as any).rpc("save_agent_settings", { p_agent_id: agentId, p_turnover: settings.turnover, p_deposit: settings.deposit, p_welcome: settings.welcome, p_credit_limit: settings.creditLimit });
  if (error) throw error;
  return data;
}

export async function getInvitedUsers(search = "") {
  if (!supabase) return null;
  const { data, error } = await (supabase as any).rpc("get_agent_invited_users", { p_search: search.trim() || null });
  if (error) throw error;
  return data ?? [];
}
