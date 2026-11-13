import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

const url = import.meta.env.VITE_SUPABASE_URL_2 ?? import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jegpxnoaimpmdekivtlw.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY_2 ?? import.meta.env.VITE_SUPABASE_JWT ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY_2 ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key
  ? createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

type LocalAuthRecord = { id: string; email: string; password: string; profile: { role: "super_admin" | "user"; balance: number; referral_code?: string; user_code?: string } };
const LOCAL_AUTH_KEY = "tp-registered-users";
const isPublicUid = (value: unknown): value is string => typeof value === "string" && /^\d{8}$/.test(value);
const newPublicUid = () => String(Math.floor(10_000_000 + Math.random() * 90_000_000));

async function reservePublicUid() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = newPublicUid();
    if (!supabase) return candidate;
    const { data, error } = await (supabase as any).from("profiles").select("id").eq("user_code", candidate).maybeSingle();
    if (!error && !data) return candidate;
  }
  throw new Error("Unable to allocate a unique User ID. Please try again.");
}

function localAuthRecords(): LocalAuthRecord[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY) ?? "[]") as LocalAuthRecord[]; } catch { return []; }
}

function saveLocalAuth(record: LocalAuthRecord) {
  const records = localAuthRecords().filter((item) => item.email !== record.email);
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify([...records, record]));
}

function fallbackAuthenticate(identity: string, password: string, mode: "login" | "register", inviteCode: string) {
  const normalized = identity.trim().toLowerCase();
  const role = normalized === "acagaming75@gmail.com" ? "super_admin" as const : "user" as const;
  const records = localAuthRecords();
  if (mode === "register") {
    if (records.some((record) => record.email === normalized)) throw new Error("An account with this contact already exists");
    const userCode = newPublicUid();
    const account: LocalAuthRecord = { id: `usr_${Date.now()}`, email: normalized, password, profile: { role, balance: 1000, referral_code: userCode, user_code: userCode } };
    saveLocalAuth(account);
    return { ...account, phone: /^\S+@\S+\.\S+$/.test(normalized) ? undefined : normalized };
  }
  const account = records.find((record) => record.email === normalized && record.password === password);
  if (!account) throw new Error("Invalid email or password");
  const userCode = isPublicUid(account.profile.user_code) ? account.profile.user_code : newPublicUid();
  const updated = { ...account, profile: { ...account.profile, role, user_code: userCode, referral_code: account.profile.referral_code || userCode } };
  saveLocalAuth(updated);
  return { ...updated, phone: /^\S+@\S+\.\S+$/.test(normalized) ? undefined : normalized };
}

export async function authenticate(identity: string, password: string, mode: "login" | "register", inviteCode = "") {
  const normalized = identity.trim().toLowerCase();
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
            const { data: referrer } = await (supabase as any).from("profiles").select("id").eq("referral_code", inviteCode.trim()).maybeSingle();
            referrerId = referrer?.id ?? null;
          }
          const userCode = await reservePublicUid();
          const { error: profileError } = await (supabase as any).from("profiles").upsert({ id: authUser.id, email: isEmail ? normalized : `${normalized}@phone.local`, role, balance: 0, user_code: userCode, referred_by: referrerId, referral_code: userCode }, { onConflict: "id" });
          if (profileError) throw profileError;
          return { id: authUser.id, email: isEmail ? normalized : "", phone: isEmail ? undefined : normalized, profile: { role, balance: 0, user_code: userCode, referral_code: userCode } };
        }
        const { data: profile } = await (supabase as any).from("profiles").select("role,balance,referral_code,user_code").eq("id", authUser.id).maybeSingle();
        let userCode = isPublicUid(profile?.user_code) ? profile.user_code : await reservePublicUid();
        if (!isPublicUid(profile?.user_code)) {
          await (supabase as any).from("profiles").update({ user_code: userCode, referral_code: profile?.referral_code || userCode }).eq("id", authUser.id);
        }
        return { id: authUser.id, email: authUser.email ?? "", phone: authUser.phone ?? undefined, profile: { ...(profile ?? { role, balance: 0 }), user_code: userCode, referral_code: profile?.referral_code || userCode } };
      }
    } catch {
      return fallbackAuthenticate(normalized, password, mode, inviteCode);
    }
  }
  return fallbackAuthenticate(normalized, password, mode, inviteCode);
}

export type ResetMethod = "phone" | "email";

export async function sendPasswordResetCode(identity: string, method: ResetMethod) {
  const normalized = identity.trim().toLowerCase();
  if (supabase) {
    if (method === "email") {
      const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo: `${window.location.origin}/login?reset=1` });
      if (error) throw error;
      return { devCode: undefined as string | undefined };
    }
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized, options: { shouldCreateUser: false } });
    if (error) throw error;
    return { devCode: undefined as string | undefined };
  }
  const accountExists = localAuthRecords().some((account) => account.email === normalized);
  if (!accountExists) return { devCode: undefined as string | undefined };
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return { devCode: String(values[0] % 1_000_000).padStart(6, "0") };
}

export async function completePasswordReset(identity: string, method: ResetMethod, token: string, newPassword: string, expectedLocalCode?: string) {
  const normalized = identity.trim().toLowerCase();
  if (supabase) {
    const { error: verifyError } = method === "email"
      ? await supabase.auth.verifyOtp({ email: normalized, token, type: "recovery" })
      : await supabase.auth.verifyOtp({ phone: normalized, token, type: "sms" });
    if (verifyError) throw verifyError;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return;
  }
  if (!expectedLocalCode || token !== expectedLocalCode) throw new Error("The verification code is incorrect or expired");
  const account = localAuthRecords().find((record) => record.email === normalized);
  if (!account) throw new Error("The verification code is incorrect or expired");
  saveLocalAuth({ ...account, password: newPassword });
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
