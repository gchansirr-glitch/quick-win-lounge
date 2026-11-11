import { Link, useNavigate } from "@tanstack/react-router";
import { Home, Gift, Share2, Wallet, User, ChevronLeft } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useStore, money } from "@/lib/store";
import { MarketSettler } from "./markets";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/activity", label: "Activity", icon: Gift },
  { to: "/promotion", label: "Promotion", icon: Share2 },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/account", label: "Account", icon: User },
] as const;

export function AppShell({ children, title, back, nav = true }: { children: ReactNode; title?: string; back?: boolean; nav?: boolean }) {
  const { user, ready, balance, lang } = useStore();
  const labels = lang === "my" ? { Home: "ပင်မ", Activity: "မှတ်တမ်း", Promotion: "ပရိုမိုးရှင်း", Wallet: "ပိုက်ဆံအိတ်", Account: "အကောင့်" } : { Home: "Home", Activity: "Activity", Promotion: "Promotion", Wallet: "Wallet", Account: "Account" };
  const navigate = useNavigate();
  useEffect(() => { if (ready && !user) navigate({ to: "/login" }); }, [ready, user, navigate]);
  if (!ready || !user) return <div className="min-h-screen bg-background" />;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
      <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          {back && (
            <button onClick={() => window.history.back()} aria-label="Back" className="shrink-0 rounded-full p-1 hover:bg-secondary"><ChevronLeft className="h-5 w-5" /></button>
          )}
          {title ? <h1 className="truncate text-xl font-bold">{title}</h1> : (
            <h1 className="truncate text-2xl font-bold tracking-wide">TP <span className="text-primary">LOTTERY</span></h1>
          )}
        </div>
        <Link to="/wallet" className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-semibold">{money(balance)}</Link>
      </header>
      <MarketSettler />
      <main className="px-4 py-4">{children}</main>
      {nav && (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-surface/95 backdrop-blur">
          <ul className="grid grid-cols-5">
            {tabs.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link to={to} activeOptions={{ exact: true }} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground data-[status=active]:text-primary">
                  <Icon className="h-5 w-5" />{labels[label as keyof typeof labels]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
