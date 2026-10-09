import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Phone, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { btnPrimary, inputCls } from "@/components/Sheet";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Log in or Register — TP LOTTERY" },
    { name: "description", content: "Sign in to TP LOTTERY with your phone number." },
    { property: "og:title", content: "Log in — TP LOTTERY" },
    { property: "og:description", content: "Sign in to TP LOTTERY with your phone number." },
  ] }),
  component: Login,
});

const CODES = ["+95", "+91", "+66", "+84", "+63", "+62", "+1"];

function Login() {
  const { login } = useStore();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [cc, setCc] = useState("+95");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [invite, setInvite] = useState("");
  const [show, setShow] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 7) return toast.error("Enter a valid phone number");
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (mode === "register" && pw !== pw2) return toast.error("Passwords do not match");
    login(`${cc} ${phone}`);
    toast.success(mode === "register" ? "Account created — MMK 1,000 welcome bonus!" : "Welcome back!");
    nav({ to: "/" });
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background">
      <div className="bg-gradient-red px-6 pb-10 pt-12">
        <h1 className="text-4xl font-bold tracking-wide text-primary-foreground">TP LOTTERY</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">{mode === "login" ? "Log in with your phone number" : "Create your account"}</p>
      </div>
      <div className="-mt-5 rounded-t-3xl bg-background px-6 pt-6">
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-card p-1">
          {(["login", "register"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-lg py-2 text-sm font-semibold capitalize ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m === "login" ? "Log in" : "Register"}</button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold"><span className="mb-2 flex items-center gap-2"><Phone className="h-4 w-4 text-primary" />Phone number</span>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <select value={cc} onChange={(e) => setCc(e.target.value)} className="rounded-xl border border-input bg-secondary px-3">
                {CODES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Phone number" className={inputCls} />
            </div>
          </label>
          <label className="block text-sm font-semibold"><span className="mb-2 flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Password</span>
            <div className="relative">
              <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className={inputCls} />
              <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password" className="absolute right-3 top-3 text-muted-foreground">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
            </div>
          </label>
          {mode === "register" && (<>
            <input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm password" className={inputCls} />
            <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Invite code (optional)" className={inputCls} />
          </>)}
          <button className={btnPrimary}>{mode === "login" ? "Log in" : "Register"}</button>
          <p className="text-center text-xs text-muted-foreground">Demo app — no real money. Any phone and password work.</p>
        </form>
      </div>
    </div>
  );
}
