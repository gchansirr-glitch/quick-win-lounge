import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, Phone, Headphones, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { authenticate, sendPasswordResetCode, completePasswordReset } from "@/lib/supabase";
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
  const [resetView, setResetView] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [sentIdentity, setSentIdentity] = useState("");
  const [sentMethod, setSentMethod] = useState<"phone" | "email" | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  useEffect(() => { if (resendSeconds <= 0) return; const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000); return () => window.clearTimeout(timer); }, [resendSeconds]);

  const resetIdentity = method === "email" ? email.trim().toLowerCase() : `${countryCode}${phone.replace(/\D/g, "")}`;
  const sendCode = async () => {
    if (method === "email" && !/^\S+@\S+\.\S+$/.test(resetIdentity)) return toast.error("Enter a valid email address");
    if (method === "phone" && phone.replace(/\D/g, "").length < 7) return toast.error("Enter a valid phone number");
    try {
      const result = await sendPasswordResetCode(resetIdentity, method);
      setSentCode(result.devCode ?? "");
      setSentIdentity(resetIdentity);
      setSentMethod(method);
      setVerificationCode("");
      setResendSeconds(60);
      toast.success(result.devCode ? `Verification code sent! (Dev test code: ${result.devCode})` : "If this account exists, a verification code has been sent.");
    } catch {
      toast.error("Unable to send a verification code. Check the contact and try again.");
    }
  };
  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sentIdentity || sentIdentity !== resetIdentity || sentMethod !== method) return toast.error("Send a new verification code for this contact first");
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (newPassword !== confirmNewPassword) return toast.error("Passwords do not match");
    try {
      await completePasswordReset(resetIdentity, method, verificationCode.trim(), newPassword, sentCode);
      toast.success("Password reset successfully! Please log in with your new password.");
      setResetView(false);
      setMode("login");
      setPw("");
      setVerificationCode("");
      setSentCode("");
      setSentIdentity("");
      setSentMethod(null);
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      toast.error("The verification code is invalid or expired. Request a new code and try again.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identity = method === "email" ? email.trim().toLowerCase() : `${countryCode}${phone.replace(/\D/g, "")}`;
    if (method === "email" && !/^\S+@\S+\.\S+$/.test(identity)) return toast.error("Enter a valid email address");
    if (method === "phone" && phone.replace(/\D/g, "").length < 7) return toast.error("Enter a valid phone number");
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (mode === "register" && pw !== pw2) return toast.error("Passwords do not match");
    try {
      const account = await authenticate(identity, pw, mode, invite);
      login(account.email || identity, remember, account.id, account.profile, account.phone);
      toast.success(mode === "register" ? "Account created — MMK 1,000 welcome bonus!" : "Welcome back!");
      nav({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to authenticate");
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background">
      {resetView ? <section className="min-h-screen px-6 pb-10 pt-10"><button type="button" onClick={() => setResetView(false)} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to Login</button><div className="mb-6"><h1 className="font-display text-3xl font-bold">Reset Password</h1><p className="mt-1 text-sm text-muted-foreground">Verify your phone or email to choose a new password.</p></div><form onSubmit={resetPassword} className="space-y-4"><div className="grid grid-cols-2 border-b border-border" role="tablist" aria-label="Reset verification method"><button type="button" role="tab" aria-selected={method === "phone"} onClick={() => setMethod("phone")} className={`flex items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold ${method === "phone" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><Phone className="h-4 w-4" />Phone Number</button><button type="button" role="tab" aria-selected={method === "email"} onClick={() => setMethod("email")} className={`flex items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold ${method === "email" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><Mail className="h-4 w-4" />Email</button></div>{method === "phone" ? <label className="block text-sm font-semibold">Phone number<div className="mt-2 flex gap-2"><select aria-label="Country calling code" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="h-12 rounded-xl border border-border bg-card px-3"><option value="+95">+95</option></select><input type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^\d\s]/g, ""))} placeholder="9xxxxxxxxx" className={`${inputCls} min-w-0 flex-1`} /></div></label> : <label className="block text-sm font-semibold">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={`${inputCls} mt-2`} /></label>}<label className="block text-sm font-semibold">Verification Code<div className="mt-2 flex gap-2"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className={`${inputCls} min-w-0 flex-1`} /><button type="button" disabled={resendSeconds > 0} onClick={sendCode} className="shrink-0 rounded-xl bg-secondary px-3 text-xs font-bold disabled:opacity-60">{resendSeconds ? `Resend in ${resendSeconds}s...` : sentCode ? "Resend Code" : "Send Code"}</button></div></label><label className="block text-sm font-semibold">New Password<div className="relative mt-2"><input type={resetPasswordVisible ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 6 characters" className={inputCls} /><button type="button" onClick={() => setResetPasswordVisible((visible) => !visible)} aria-label="Toggle new password visibility" className="absolute right-3 top-3 text-muted-foreground">{resetPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label><label className="block text-sm font-semibold">Confirm New Password<input type={resetPasswordVisible ? "text" : "password"} autoComplete="new-password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} placeholder="Confirm new password" className={`${inputCls} mt-2`} /></label><button className={btnPrimary}>Reset Password</button></form></section> : <>
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
          <div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-primary" />Remember password</label>{mode === "login" && <button type="button" onClick={() => setResetView(true)} className="text-sm text-muted-foreground transition hover:text-primary">Forgot password?</button>}</div>
          {mode === "register" && (<>
            <input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm password" className={inputCls} />
            <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Invitation Code (6–8 digits, optional)" className={inputCls} />
          </>)}
          <button className={btnPrimary}>{mode === "login" ? "Log in" : "Register"}</button>
        </form>
      </div>
      </>}
      <a href="https://t.me/" target="_blank" rel="noreferrer" aria-label="Customer service" className="fixed bottom-6 right-5 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><Headphones className="h-6 w-6" /></a>
    </div>
  );
}
