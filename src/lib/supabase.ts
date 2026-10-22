import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

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
