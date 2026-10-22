import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore, money } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/agent")({ component: AgentPortal });

type Player = { player_id: string; created_at: string; profile?: { email: string; balance: number } };
type Ledger = { id: string; type: string; amount: number; created_at: string; note: string | null };

function AgentPortal() {
  const { user, ready } = useStore();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user || user.role !== "affiliate-agent") { navigate({ to: "/" }); return; }
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | undefined;
    const load = async () => {
      if (!supabase) return;
      const { data: downline } = await (supabase as any).from("agent_players").select("player_id, created_at, profiles!agent_players_player_id_fkey(email, balance)").eq("agent_id", user.uid);
      const { data: earnings } = await (supabase as any).from("financial_ledger").select("id, type, amount, created_at, note").eq("user_id", user.uid).eq("type", "commission").order("created_at", { ascending: false }).limit(100);
      setPlayers((downline ?? []).map((item: any) => ({ ...item, profile: item.profiles })));
      setLedger(earnings ?? []);
      setLoading(false);
    };
    void load();
    if (supabase) channel = supabase.channel(`agent-sync:${user.uid}`).on("postgres_changes", { event: "*", schema: "public", table: "agent_players", filter: `agent_id=eq.${user.uid}` }, () => void load()).on("postgres_changes", { event: "INSERT", schema: "public", table: "financial_ledger", filter: `user_id=eq.${user.uid}` }, () => void load()).subscribe();
    return () => { if (channel) void channel.unsubscribe(); };
  }, [ready, user, navigate]);

  if (!ready || !user || user.role !== "affiliate-agent") return null;
  const earnings = ledger.reduce((sum, entry) => sum + Number(entry.amount), 0);
  return <AppShell title="Affiliate Agent" back><main className="flex flex-col gap-5 pb-6"><header><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Live downline portal</p><h1 className="mt-1 font-display text-3xl font-bold">Agent workspace</h1><p className="mt-1 text-sm text-muted-foreground">{user.email}</p></header><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Players</p><p className="mt-1 font-display text-2xl font-bold">{players.length}</p></div><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Commission earned</p><p className="mt-1 font-display text-xl font-bold text-primary">{money(earnings)}</p></div></div><section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-display text-xl font-bold">Downline players</h2><div className="mt-4 flex flex-col gap-2">{loading ? <p className="text-sm text-muted-foreground">Loading shared data…</p> : players.length ? players.map((player) => <div key={player.player_id} className="flex items-center justify-between rounded-xl bg-secondary p-3"><div><p className="text-sm font-semibold">{player.profile?.email ?? player.player_id}</p><p className="text-xs text-muted-foreground">Joined {new Date(player.created_at).toLocaleDateString()}</p></div><p className="text-sm font-bold">{money(Number(player.profile?.balance ?? 0))}</p></div>) : <p className="text-sm text-muted-foreground">No downline players yet.</p>}</div></section><section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-display text-xl font-bold">Commission ledger</h2><div className="mt-4 flex flex-col gap-2">{ledger.length ? ledger.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-xl bg-secondary p-3"><div><p className="text-sm font-semibold">{entry.note ?? "Commission"}</p><p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p></div><p className="font-bold text-primary">+{money(Number(entry.amount))}</p></div>) : <p className="text-sm text-muted-foreground">No commission records yet.</p>}</div></section></main></AppShell>;
}
