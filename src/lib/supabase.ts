import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

const url = import.meta.env.VITE_SUPABASE_URL_2 ?? import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jegpxnoaimpmdekivtlw.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY_2 ?? import.meta.env.VITE_SUPABASE_JWT ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY_2 ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key
  ? createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export async function authenticate(email: string, password: string, mode: "login" | "register") {
  if (!supabase) throw new Error("Shared authentication is not configured");
  const result = mode === "register"
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  if (!result.data.user) throw new Error("Authentication did not return a user");
  return result.data.user;
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
