import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

const url = import.meta.env.VITE_SUPABASE_URL_2 ?? import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jegpxnoaimpmdekivtlw.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY_2 ?? import.meta.env.VITE_SUPABASE_JWT ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY_2 ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key
  ? createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

type LocalAuthRecord = { id: string; email: string; password: string; profile: { role: "super_admin" | "user"; balance: number; referral_code?: string; user_code?: string } };
const LOCAL_AUTH_KEY = "tp-registered-users";
const SUPER_ADMIN_EMAIL = "acagaming75@gmail.com";
const isPublicUid = (value: unknown): value is string => typeof value === "string" && /^\d{8}$/.test(value);
const newPublicUid = () => String(Math.floor(10_000_000 + Math.random() * 90_000_000));
const newLocalPublicUid = (records: LocalAuthRecord[]) => {
  let candidate = newPublicUid();
  while (records.some((record) => record.profile.user_code === candidate)) candidate = newPublicUid();
  return candidate;
};

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
  const role = "user" as const;
  const records = localAuthRecords();
  if (mode === "register") {
    if (records.some((record) => record.email === normalized)) throw new Error("An account with this contact already exists");
    const userCode = newLocalPublicUid(records);
    const account: LocalAuthRecord = { id: `usr_${Date.now()}`, email: normalized, password, profile: { role, balance: 1000, referral_code: userCode, user_code: userCode } };
    saveLocalAuth(account);
    return { ...account, profile: { ...account.profile, welcome_bonus: 1000 }, phone: /^\S+@\S+\.\S+$/.test(normalized) ? undefined : normalized };
  }
  const account = records.find((record) => record.email === normalized && record.password === password);
  if (!account) throw new Error("Invalid email or password");
  const userCode = isPublicUid(account.profile.user_code) ? account.profile.user_code : newLocalPublicUid(records.filter((record) => record.email !== normalized));
  const updated = { ...account, profile: { ...account.profile, role, user_code: userCode, referral_code: account.profile.referral_code || userCode } };
  saveLocalAuth(updated);
  return { ...updated, phone: /^\S+@\S+\.\S+$/.test(normalized) ? undefined : normalized };
}

export async function authenticate(identity: string, password: string, mode: "login" | "register", inviteCode = "") {
  const normalized = identity.trim().toLowerCase();
  if (supabase) {
    try {
      const isEmail = /^\S+@\S+\.\S+$/.test(normalized);
      const proposedUserCode = mode === "register" ? await reservePublicUid() : undefined;
      const signupOptions = { data: { invite_code: inviteCode.trim().toUpperCase(), public_uid: proposedUserCode } };
      const result = mode === "register"
        ? isEmail ? await supabase.auth.signUp({ email: normalized, password, options: signupOptions }) : await supabase.auth.signUp({ phone: normalized, password, options: signupOptions })
        : isEmail ? await supabase.auth.signInWithPassword({ email: normalized, password }) : await supabase.auth.signInWithPassword({ phone: normalized, password });
      if (!result.error && result.data.user) {
        const authUser = result.data.user;
        const role = "user";
        if (mode === "register") {
          const userCode = proposedUserCode ?? newPublicUid();
          return { id: authUser.id, email: isEmail ? normalized : "", phone: isEmail ? undefined : normalized, profile: { role, balance: 0, user_code: userCode, referral_code: userCode } };
        }
        const { data: profile } = await (supabase as any).from("profiles").select("role,balance,referral_code,user_code").eq("id", authUser.id).maybeSingle();
        const { data: roleRows } = await (supabase as any).from("user_roles").select("role").eq("user_id", authUser.id).in("role", ["admin", "sub_admin", "super_admin"]);
        const assignedRole = (roleRows ?? []).some((item: { role: string }) => item.role === "super_admin") ? "super_admin" : (roleRows ?? []).some((item: { role: string }) => item.role === "admin") ? "admin" : (roleRows ?? []).some((item: { role: string }) => item.role === "sub_admin") ? "sub_admin" : normalized === SUPER_ADMIN_EMAIL ? "super_admin" : "user";
        if (mode === "login") void (supabase as any).rpc("record_login_event", { p_device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 250) : "Web", p_ip: null, p_status: "success" });
        let userCode = profile?.user_code;
        let referralCode = profile?.referral_code;
        if (!isPublicUid(userCode)) {
          const { data: ensured } = await (supabase as any).rpc("ensure_my_public_id");
          const ensuredRow = Array.isArray(ensured) ? ensured[0] : ensured;
          userCode = ensuredRow?.user_code;
          referralCode = ensuredRow?.referral_code;
        }
        if (!isPublicUid(userCode)) throw new Error("Could not load your User ID. Please retry.");
        return { id: authUser.id, email: authUser.email ?? "", phone: authUser.phone ?? undefined, profile: { ...(profile ?? { role, balance: 0 }), role: assignedRole, user_code: userCode, referral_code: referralCode || userCode } };
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

export async function saveUserPayoutAccounts(accounts: { kpayPhone: string; kpayName: string; wavePhone: string; waveName: string }) {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please sign in again");
  for (const account of [{ method: "KPay", account_number: accounts.kpayPhone, account_name: accounts.kpayName }, { method: "Wave Pay", account_number: accounts.wavePhone, account_name: accounts.waveName }]) {
    if (!account.account_number.trim()) continue;
    const { data: existing, error: lookupError } = await (supabase as any).from("payout_accounts").select("id").eq("user_id", auth.user.id).eq("method", account.method).maybeSingle();
    if (lookupError) throw lookupError;
    const result = existing
      ? await (supabase as any).from("payout_accounts").update({ account_number: account.account_number.trim(), account_name: account.account_name.trim() }).eq("id", existing.id)
      : await (supabase as any).from("payout_accounts").insert({ user_id: auth.user.id, method: account.method, account_number: account.account_number.trim(), account_name: account.account_name.trim() });
    if (result.error) throw result.error;
  }
  return true;
}

export async function createDepositRequest(input: { amount: number; method: string; senderAccount: string; receiverAccount: string; senderName?: string; slipLast5?: string; receiptUrl?: string }) {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please sign in again");
  const { error } = await (supabase as any).from("transaction_requests").insert({ user_id: auth.user.id, type: "deposit", amount: input.amount, method: input.method, sender_account: input.senderAccount, sender_name: input.senderName ?? null, receiver_account: input.receiverAccount, slip_last5: input.slipLast5 ?? null, receipt_url: input.receiptUrl ?? null, status: "pending" });
  if (error) throw error;
  return true;
}

export async function createWithdrawalRequest(input: { amount: number; method: string; recipientName: string; accountNumber: string }) {
  if (!supabase) return null;
  const { data, error } = await (supabase as any).rpc("request_withdrawal", { p_amount: input.amount, p_method: input.method, p_recipient: input.recipientName, p_account: input.accountNumber });
  if (error) throw error;
  return data;
}

export async function signOutShared() {
  if (!supabase) return;
  try { await (supabase as any).rpc("record_logout_event"); } catch { /* Continue sign-out if history logging is unavailable. */ }
  await supabase.auth.signOut();
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
