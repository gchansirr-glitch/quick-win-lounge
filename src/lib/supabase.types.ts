export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; email: string; role: "super_admin" | "sub_admin" | "affiliate_agent" | "user"; enabled: boolean; balance: number; credit_balance: number; referral_code: string | null; referred_by: string | null; created_at: string; updated_at: string }; Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; email: string }; Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]> };
      vip_levels: { Row: { level: number; name: string; wager_required: number; commission_percent: number; upgrade_bonus: number; monthly_bonus: number; updated_at: string }; Insert: Partial<Database["public"]["Tables"]["vip_levels"]["Row"]> & { level: number; name: string }; Update: Partial<Database["public"]["Tables"]["vip_levels"]["Row"]> };
      bet_rounds: { Row: { id: string; market_id: string; starts_at: string; ends_at: string; status: string; total_up: number; total_down: number; active_bets: number; participants: number; house_pnl: number; created_at: string }; Insert: Partial<Database["public"]["Tables"]["bet_rounds"]["Row"]> & { market_id: string; starts_at: string; ends_at: string }; Update: Partial<Database["public"]["Tables"]["bet_rounds"]["Row"]> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { app_role: "super_admin" | "sub_admin" | "affiliate_agent" | "user" };
    CompositeTypes: Record<string, never>;
  };
};
