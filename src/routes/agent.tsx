import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore, money } from "@/lib/store";
import { getInvitedUsers, reviewSharedCashRequest, supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/agent")({ component: AgentPortal });

type Player = { player_id: string; created_at: string; profile?: { email: string; balance: number } };
type Ledger = { id: string; type: string; amount: number; created_at: string; note: string | null };
type CashRequest = { id: string; user_id: string; type: "deposit" | "withdrawal"; amount: number; method: string; status: string; created_at: string };
type InvitedUser = { user_id: string; user_code: string; registered_at: string; balance: number; total_deposit: number; total_bet_volume: number; total_commission: number };

function AgentPortal() {
  const { user, ready } = useStore();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [requests, setRequests] = useState<CashRequest[]>([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user || user.role !== "affiliate-agent") { navigate({ to: "/" }); return; }
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | undefined;
    const load = async () => {
      if (!supabase) return;
      const { data: downline } = await (supabase as any).from("agent_players").select("player_id, created_at, profiles!agent_players_player_id_fkey(email, balance)").eq("agent_id", user.uid);
      const { data: earnings } = await (supabase as any).from("financial_ledger").select("id, type, amount, created_at, note").eq("user_id", user.uid).eq("type", "commission").order("created_at", { ascending: false }).limit(100);
      const { data: profile } = await (supabase as any).from("profiles").select("credit_balance").eq("id", user.uid).maybeSingle();
      const { data: cashRequests } = await (supabase as any).from("cash_requests").select("id, user_id, type, amount, method, status, created_at").eq("agent_id", user.uid).eq("status", "pending").order("created_at", { ascending: false });
      const invited = await getInvitedUsers(userSearch);
      setPlayers((downline ?? []).map((item: any) => ({ ...item, profile: item.profiles })));
      setLedger(earnings ?? []);
      setCreditBalance(Number(profile?.credit_balance ?? 0));
      setRequests(cashRequests ?? []);
      setInvitedUsers(invited as InvitedUser[]);
      setLoading(false);
    };
    void load();
    if (supabase) channel = supabase.channel(`agent-sync:${user.uid}`).on("postgres_changes", { event: "*", schema: "public", table: "agent_players", filter: `agent_id=eq.${user.uid}` }, () => void load()).on("postgres_changes", { event: "INSERT", schema: "public", table: "financial_ledger", filter: `user_id=eq.${user.uid}` }, () => void load()).subscribe();
    return () => { if (channel) void channel.unsubscribe(); };
  }, [ready, user, navigate]);

  if (!ready || !user || user.role !== "affiliate-agent") return null;
  const earnings = ledger.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const review = async (requestId: string, status: "approved" | "rejected") => { try { await reviewSharedCashRequest(requestId, status); setRequests((items) => items.filter((item) => item.id !== requestId)); toast.success(`Request ${status}`); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to review request"); } };
  return <AppShell title="Affiliate Agent" back><main className="flex flex-col gap-5 pb-6"><header><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Live downline portal</p><h1 className="mt-1 font-display text-3xl font-bold">Agent workspace</h1><p className="mt-1 text-sm text-muted-foreground">{user.email}</p></header><div className="grid grid-cols-3 gap-3"><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Players</p><p className="mt-1 font-display text-2xl font-bold">{players.length}</p></div><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Commission earned</p><p className="mt-1 font-display text-xl font-bold text-primary">{money(earnings)}</p></div></div><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Available credit</p><p className="mt-1 font-display text-xl font-bold">{money(creditBalance)}</p></div><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Invited Users</h2><span className="text-xs text-muted-foreground">{invitedUsers.length}</span></div><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search by User ID" aria-label="Search by User ID" className="mt-3 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /><div className="mt-4 space-y-2">{invitedUsers.length ? invitedUsers.map((player) => <div key={player.user_id} className="rounded-xl bg-secondary p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-bold">{player.user_code}</p><p className="text-xs text-muted-foreground">Registered {new Date(player.registered_at).toLocaleString()}</p></div><p className="font-bold">{money(Number(player.balance))}</p></div><div className="mt-2 grid grid-cols-3 gap-2 text-xs"><div><p className="text-muted-foreground">Deposit</p><p className="font-semibold">{money(Number(player.total_deposit))}</p></div><div><p className="text-muted-foreground">Bet volume</p><p className="font-semibold">{money(Number(player.total_bet_volume))}</p></div><div><p className="text-muted-foreground">Commission</p><p className="font-semibold">{money(Number(player.total_commission))}</p></div></div></div>) : <p className="text-sm text-muted-foreground">No invited users found.</p>}</div></section><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Pending requests</h2><span className="text-xs text-muted-foreground">{requests.length}</span></div><div className="mt-4 flex flex-col gap-2">{requests.length ? requests.map((request) => <div key={request.id} className="rounded-xl bg-secondary p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold capitalize">{request.type} · {request.method}</p><p className="text-xs text-muted-foreground">{new Date(request.created_at).toLocaleString()}</p></div><p className="font-bold">{money(Number(request.amount))}</p></div><div className="mt-3 flex gap-2"><button onClick={() => void review(request.id, "approved")} className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground">Approve</button><button onClick={() => void review(request.id, "rejected")} className="flex-1 rounded-lg bg-background py-2 text-xs font-bold text-destructive">Reject</button></div></div>) : <p className="text-sm text-muted-foreground">No pending requests.</p>}</div></section><section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-display text-xl font-bold">Downline players</h2><div className="mt-4 flex flex-col gap-2">{loading ? <p className="text-sm text-muted-foreground">Loading shared data…</p> : players.length ? players.map((player) => <div key={player.player_id} className="flex items-center justify-between rounded-xl bg-secondary p-3"><div><p className="text-sm font-semibold">{player.profile?.email ?? player.player_id}</p><p className="text-xs text-muted-foreground">Joined {new Date(player.created_at).toLocaleDateString()}</p></div><p className="text-sm font-bold">{money(Number(player.profile?.balance ?? 0))}</p></div>) : <p className="text-sm text-muted-foreground">No downline players yet.</p>}</div></section><section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-display text-xl font-bold">Commission ledger</h2><div className="mt-4 flex flex-col gap-2">{ledger.length ? ledger.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-xl bg-secondary p-3"><div><p className="text-sm font-semibold">{entry.note ?? "Commission"}</p><p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p></div><p className="font-bold text-primary">+{money(Number(entry.amount))}</p></div>) : <p className="text-sm text-muted-foreground">No commission records yet.</p>}</div></section></main></AppShell>;
}
