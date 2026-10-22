import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { authenticate } from "@/lib/supabase";
import { btnPrimary, inputCls } from "@/components/Sheet";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Log in or Register — Trade X" },
    { name: "description", content: "Sign in to Trade X with your email address." },
    { property: "og:title", content: "Log in — Trade X" },
    { property: "og:description", content: "Sign in to Trade X with your email address." },
  ] }),
  component: Login,
});

function Login() {
  const { login } = useStore();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [invite, setInvite] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email address");
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (mode === "register" && pw !== pw2) return toast.error("Passwords do not match");
    try {
      const account = await authenticate(email.trim().toLowerCase(), pw, mode);
      login(account.email ?? email.trim().toLowerCase(), remember, account.id);
      toast.success(mode === "register" ? "Account created — MMK 1,000 welcome bonus!" : "Welcome back!");
      nav({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to authenticate");
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background">
      <div className="bg-gradient-red px-6 pb-10 pt-12">
        <h1 className="text-4xl font-bold tracking-wide text-primary-foreground">Trade X</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">{mode === "login" ? "Log in with your email address" : "Create your account"}</p>
      </div>
      <div className="-mt-5 rounded-t-3xl bg-background px-6 pt-6">
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-card p-1">
          {(["login", "register"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-lg py-2 text-sm font-semibold capitalize ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m === "login" ? "Log in" : "Register"}</button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold"><span className="mb-2 flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Email address</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
          </label>
          <label className="block text-sm font-semibold"><span className="mb-2 flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Password</span>
            <div className="relative">
              <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className={inputCls} />
              <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password" className="absolute right-3 top-3 text-muted-foreground">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
            </div>
          </label>
          {mode === "login" && <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-primary" />Remember me on this device</label>}
          {mode === "register" && (<>
            <input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm password" className={inputCls} />
            <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Invite code (optional)" className={inputCls} />
          </>)}
          <button className={btnPrimary}>{mode === "login" ? "Log in" : "Register"}</button>
          <p className="text-center text-xs text-muted-foreground">Frontend demo — no real money. Use any email and password.</p>
        </form>
      </div>
    </div>
  );
}
