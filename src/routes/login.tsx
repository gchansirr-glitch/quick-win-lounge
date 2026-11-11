import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, Phone, Headphones } from "lucide-react";
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
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+95");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [invite, setInvite] = useState("");
  useEffect(() => { setInvite(new URLSearchParams(window.location.search).get("invite") ?? ""); }, []);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identity = method === "email" ? email.trim().toLowerCase() : `${countryCode}${phone.replace(/\D/g, "")}`;
    if (method === "email" && !/^\S+@\S+\.\S+$/.test(identity)) return toast.error("Enter a valid email address");
    if (method === "phone" && phone.replace(/\D/g, "").length < 7) return toast.error("Enter a valid phone number");
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (mode === "register" && pw !== pw2) return toast.error("Passwords do not match");
    try {
      const account = await authenticate(identity, pw, mode, invite);
      login(account.email ?? identity, remember, account.id, account.profile);
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
          <div className="grid grid-cols-2 border-b border-border" role="tablist" aria-label="Login method">
            <button type="button" role="tab" aria-selected={method === "phone"} onClick={() => setMethod("phone")} className={`flex items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${method === "phone" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><Phone className="h-4 w-4" />Phone Number</button>
            <button type="button" role="tab" aria-selected={method === "email"} onClick={() => setMethod("email")} className={`flex items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${method === "email" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><Mail className="h-4 w-4" />Email</button>
          </div>
          {method === "phone" ? <label className="block text-sm font-semibold"><span className="mb-2 block">Phone number</span><div className="flex gap-2"><select aria-label="Country calling code" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="h-12 rounded-xl border border-border bg-card px-3"><option value="+95">+95</option></select><input type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^\d\s]/g, ""))} placeholder="9xxxxxxxxx" className={`${inputCls} min-w-0 flex-1`} /></div></label> : <label className="block text-sm font-semibold"><span className="mb-2 flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputCls} /></label>}
          <label className="block text-sm font-semibold"><span className="mb-2 flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Password</span>
            <div className="relative">
              <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className={inputCls} />
              <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password" className="absolute right-3 top-3 text-muted-foreground">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
            </div>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-primary" />Remember password</label>
          {mode === "register" && (<>
            <input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm password" className={inputCls} />
            <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Invitation Code (6–8 digits, optional)" className={inputCls} />
          </>)}
          <button className={btnPrimary}>{mode === "login" ? "Log in" : "Register"}</button>
        </form>
      </div>
      <a href="https://t.me/" target="_blank" rel="noreferrer" aria-label="Customer service" className="fixed bottom-6 right-5 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><Headphones className="h-6 w-6" /></a>
    </div>
  );
}
