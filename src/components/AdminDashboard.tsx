import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Activity, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Banknote, ChevronRight, CircleUserRound, Clock3, Download, FileClock, Search, ShieldCheck, Users, WalletCards, X, type LucideIcon } from "lucide-react";
import { useStore, money, SUPER_ADMIN_EMAIL } from "@/lib/store";
import { AuditLogsView, LoginHistoryView, PayoutAccountsView, TransactionsView } from "@/components/AdminTabViews";
import { supabase } from "@/lib/supabase";

type AdminRole = "admin" | "sub_admin" | "super_admin";
type ProfileRow = { id: string; email: string; username: string | null; full_name: string | null; phone: string | null; user_code: string | null; status: string; balance: number; frozen_balance: number; total_deposit: number; total_withdrawal: number; total_bonus: number; last_login_at: string | null; device_info: string | null; referral_code: string | null; referred_by: string | null; created_at: string };
type RequestRow = { id: string; user_id: string; type: "deposit" | "withdrawal"; amount: number; method: string; sender_account: string | null; sender_name: string | null; receiver_account: string | null; recipient_name: string | null; recipient_account: string | null; slip_last5: string | null; receipt_url: string | null; status: string; reason: string | null; transfer_reference: string | null; reviewed_by: string | null; created_at: string };
type PayoutRow = { id: string; user_id: string; method: string; account_name: string; account_number: string; verification_status: string; linked_at: string };
type RoleRow = { user_id: string; role: AdminRole; granted_by: string | null; created_at: string };
type AuditRow = { id: string; staff_id: string | null; staff_email: string; action_type: string; target_id: string | null; reason: string; metadata: Record<string, unknown>; created_at: string };
type LoginRow = { id: string; user_id: string; login_at: string; logout_at: string | null; device: string | null; ip_address: string | null; status: string; risk_flag: string | null };
type WalletRow = { id: string; kind: string; amount: number; detail: string; created_at: string };
type BetRow = { id: string; round_id: string; market_id: string; duration_seconds: number; side: string; result: string | null; status: string; amount: number; payout: number; profit_loss: number; created_at: string };
type TabId = "users" | "payout" | "transactions" | "logins" | "audit" | "access";

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "users", label: "All Users", icon: Users },
  { id: "payout", label: "Withdrawal Accounts", icon: WalletCards },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "logins", label: "Login History", icon: ShieldCheck },
  { id: "audit", label: "Admin Audit Logs", icon: FileClock },
];
const detailTabs = ["Profile", "Account Status", "Payout Account", "Wallet Overview", "Transactions", "Bets", "Logins", "Referral"] as const;
type DetailTab = (typeof detailTabs)[number];

export function AdminDashboard() {
  const store = useStore();
  const navigate = useNavigate();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [userRows, setUserRows] = useState<ProfileRow[]>([]);
  const [totalUserCount, setTotalUserCount] = useState(0);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutRow[]>([]);
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [loginRows, setLoginRows] = useState<LoginRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payoutFilter, setPayoutFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [requestView, setRequestView] = useState<"deposit" | "withdrawal">("deposit");
  const [requestStatus, setRequestStatus] = useState("all");
  const [loginStatus, setLoginStatus] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("Profile");
  const [detailRequests, setDetailRequests] = useState<WalletRow[]>([]);
  const [detailBets, setDetailBets] = useState<BetRow[]>([]);
  const [detailLogins, setDetailLogins] = useState<LoginRow[]>([]);
  const [detailPayouts, setDetailPayouts] = useState<PayoutRow[]>([]);
  const [detailAudit, setDetailAudit] = useState<AuditRow[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [statusDraft, setStatusDraft] = useState("active");
  const [statusReason, setStatusReason] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [roleIdentifier, setRoleIdentifier] = useState("");
  const [rolePreview, setRolePreview] = useState<"owner" | "super_admin" | "sub_admin">("owner");
  const [now, setNow] = useState(Date.now());
  const [reloadKey, setReloadKey] = useState(0);
  const superAdmin = role === "super_admin";
  const canManageSubAdmins = superAdmin && rolePreview !== "sub_admin";

  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(interval); }, []);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let live = true;
    const load = async () => {
      if (!store.ready) return;
      const primaryAdmin = store.user?.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
      if (primaryAdmin) { setRole("super_admin"); setAuthorized(true); }
      const authId = store.user?.authId;
      if (!supabase || !authId) {
        if (primaryAdmin) {
          setLoadError("Supabase session is not active. Admin access is available, but live records require a database session.");
        } else {
          setLoadError("Secure Supabase admin session required.");
        }
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError("");
      const { data: roles, error: roleError } = await (supabase as any).from("user_roles").select("user_id,role,granted_by,created_at").eq("user_id", authId).in("role", ["admin", "sub_admin", "super_admin"]);
      if (!live) return;
      if (roleError && !primaryAdmin) { setLoadError("Unable to verify admin permissions. Apply the SQL migration, then retry."); setLoading(false); return; }
      const roleValue = primaryAdmin ? "super_admin" : (roles ?? []).some((item: RoleRow) => item.role === "super_admin") ? "super_admin" : (roles ?? []).some((item: RoleRow) => item.role === "admin") ? "admin" : (roles ?? []).some((item: RoleRow) => item.role === "sub_admin") ? "sub_admin" : null;
      setRole(roleValue);
      setAuthorized(Boolean(roleValue));
      if (!roleValue) { setLoading(false); navigate({ to: "/" }); return; }
      const [usersResult, requestResult, payoutResult, allRolesResult, auditResult, loginsResult] = await Promise.all([
        (supabase as any).from("profiles").select("id,email,username,full_name,phone,user_code,status,balance,frozen_balance,total_deposit,total_withdrawal,total_bonus,last_login_at,device_info,referral_code,referred_by,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(1000),
        (supabase as any).from("transaction_requests").select("id,user_id,type,amount,method,sender_account,sender_name,receiver_account,recipient_name,recipient_account,slip_last5,receipt_url,status,reason,transfer_reference,reviewed_by,created_at").order("created_at", { ascending: false }).limit(1000),
        (supabase as any).from("payout_accounts").select("id,user_id,method,account_name,account_number,verification_status,linked_at").order("linked_at", { ascending: false }).limit(1000),
        roleValue === "super_admin" ? (supabase as any).from("user_roles").select("user_id,role,granted_by,created_at").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        (supabase as any).from("admin_audit_logs").select("id,staff_id,staff_email,action_type,target_id,reason,metadata,created_at").order("created_at", { ascending: false }).limit(500),
        (supabase as any).from("login_history").select("id,user_id,login_at,logout_at,device,ip_address,status,risk_flag").order("login_at", { ascending: false }).limit(500),
      ]);
      if (!live) return;
      const queryError = usersResult.error || requestResult.error || payoutResult.error || auditResult.error || loginsResult.error;
      if (queryError) setLoadError("Some admin data could not be loaded. Check Supabase policies and the migration.");
      setUserRows(usersResult.data ?? []);
      setTotalUserCount(usersResult.count ?? usersResult.data?.length ?? 0);
      setRequests(requestResult.data ?? []);
      setPayoutAccounts(payoutResult.data ?? []);
      setRoleRows(allRolesResult.data ?? []);
      setAuditRows(auditResult.data ?? []);
      setLoginRows(loginsResult.data ?? []);
      setLoading(false);
    };
    void load();
    return () => { live = false; };
  }, [store.ready, store.user?.authId, reloadKey, navigate]);

  useEffect(() => {
    if (!authorized || !supabase) return;
    const channel = supabase.channel("tradex-admin-dashboard-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_requests" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "payout_accounts" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "login_history" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_audit_logs" }, reload)
      .subscribe();
    return () => { void channel.unsubscribe(); };
  }, [authorized, reload]);

  useEffect(() => {
    if (!selectedUser || !supabase) return;
    setStatusDraft(selectedUser.status || "active");
    setStatusReason("");
    const loadDetail = async () => {
      const [wallet, bets, logins, payout, audit, referrals] = await Promise.all([
        (supabase as any).from("wallet_transactions").select("id,kind,amount,detail,created_at").eq("user_id", selectedUser.id).order("created_at", { ascending: false }).limit(100),
        (supabase as any).from("bets").select("id,round_id,market_id,duration_seconds,side,result,status,amount,payout,profit_loss,created_at").eq("user_id", selectedUser.id).order("created_at", { ascending: false }).limit(100),
        (supabase as any).from("login_history").select("id,user_id,login_at,logout_at,device,ip_address,status,risk_flag").eq("user_id", selectedUser.id).order("login_at", { ascending: false }).limit(100),
        (supabase as any).from("payout_accounts").select("id,user_id,method,account_name,account_number,verification_status,linked_at").eq("user_id", selectedUser.id).order("linked_at", { ascending: false }),
        (supabase as any).from("admin_audit_logs").select("id,staff_id,staff_email,action_type,target_id,reason,metadata,created_at").eq("target_id", selectedUser.id).order("created_at", { ascending: false }).limit(100),
        (supabase as any).from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", selectedUser.id),
      ]);
      setDetailRequests(wallet.data ?? []);
      setDetailBets(bets.data ?? []);
      setDetailLogins(logins.data ?? []);
      setDetailPayouts(payout.data ?? []);
      setDetailAudit(audit.data ?? []);
      setReferralCount(referrals.count ?? 0);
    };
    void loadDetail();
  }, [selectedUser]);

  const profileById = useMemo(() => new Map(userRows.map((profile) => [profile.id, profile])), [userRows]);
  const filteredUsers = useMemo(() => userRows.filter((profile) => {
    const needle = search.trim().toLowerCase();
    if (needle && ![profile.user_code, profile.username, profile.full_name, profile.phone, profile.email].some((value) => value?.toLowerCase().includes(needle))) return false;
    if (statusFilter !== "all" && profile.status !== statusFilter) return false;
    const linked = payoutAccounts.some((account) => account.user_id === profile.id);
    if (payoutFilter === "linked" && !linked) return false;
    if (payoutFilter === "unlinked" && linked) return false;
    if (dateFrom && new Date(profile.created_at) < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && new Date(profile.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
    return true;
  }), [userRows, search, statusFilter, payoutFilter, dateFrom, dateTo, payoutAccounts]);
  const filteredPayoutUsers = useMemo(() => userRows.filter((profile) => {
    const needle = search.trim().toLowerCase();
    if (needle && ![profile.user_code, profile.username, profile.full_name, profile.phone, profile.email].some((value) => value?.toLowerCase().includes(needle))) return false;
    if (statusFilter !== "all" && profile.status !== statusFilter) return false;
    const linked = payoutAccounts.some((account) => account.user_id === profile.id);
    if (payoutFilter === "linked" && !linked) return false;
    if (payoutFilter === "unlinked" && linked) return false;
    if (dateFrom && new Date(profile.created_at) < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && new Date(profile.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
    return true;
  }), [userRows, search, statusFilter, payoutFilter, dateFrom, dateTo, payoutAccounts]);
  const filteredTransactions = useMemo(() => requests.filter((request) => {
    if (request.type !== requestView) return false;
    if (requestStatus === "pending" && !["pending", "approved"].includes(request.status)) return false;
    if (requestStatus === "rejected" && !["rejected", "failed"].includes(request.status)) return false;
    if (requestStatus === "completed" && request.status !== "completed") return false;
    const profile = profileById.get(request.user_id);
    const needle = search.trim().toLowerCase();
    if (needle && ![request.id, profile?.user_code, profile?.username, request.method].some((value) => value?.toLowerCase().includes(needle))) return false;
    return true;
  }), [requests, requestView, requestStatus, search, profileById]);
  const filteredLoginRows = useMemo(() => loginRows.filter((row) => {
    if (loginStatus === "all") return true;
    const profile = profileById.get(row.user_id);
    if (loginStatus === "suspended") return row.status === "suspended" || profile?.status === "suspended";
    return row.status === loginStatus;
  }), [loginRows, loginStatus, profileById]);
  const filteredAuditRows = useMemo(() => auditRows.filter((row) => {
    const needle = auditSearch.trim().toLowerCase();
    if (!needle) return true;
    const profile = row.target_id ? profileById.get(row.target_id) : undefined;
    return [row.action_type, row.target_id, row.staff_email, row.reason, profile?.user_code, profile?.full_name, JSON.stringify(row.metadata)].some((value) => value?.toLowerCase().includes(needle));
  }), [auditRows, auditSearch, profileById]);

  const completedDeposits = requests.filter((request) => request.type === "deposit" && request.status === "completed");
  const completedWithdrawals = requests.filter((request) => request.type === "withdrawal" && request.status === "completed");
  const pendingDeposits = requests.filter((request) => request.type === "deposit" && request.status === "pending").length;
  const pendingWithdrawals = requests.filter((request) => request.type === "withdrawal" && request.status === "pending").length;
  const stats = [
    { label: "Total Users", value: totalUserCount.toLocaleString(), detail: "စုစုပေါင်းအသုံးပြုသူအရေအတွက်", icon: Users },
    { label: "Active Today", value: userRows.filter((profile) => isTodayYangon(profile.last_login_at)).length.toLocaleString(), detail: "ယနေ့ဝင်ရောက်အသုံးပြုသူ", icon: Activity },
    { label: "New Today", value: userRows.filter((profile) => isTodayYangon(profile.created_at)).length.toLocaleString(), detail: "ယနေ့အသစ်စာရင်းသွင်းသူ", icon: CircleUserRound },
    { label: "Depositors / Total Deposit", value: `${new Set(completedDeposits.map((request) => request.user_id)).size} / ${money(completedDeposits.reduce((sum, request) => sum + Number(request.amount), 0))}`, detail: "ငွေသွင်းသူ / စုစုပေါင်း", icon: ArrowDownToLine },
    { label: "Withdrawers / Total Withdrawal", value: `${new Set(completedWithdrawals.map((request) => request.user_id)).size} / ${money(completedWithdrawals.reduce((sum, request) => sum + Number(request.amount), 0))}`, detail: "ငွေထုတ်သူ / စုစုပေါင်း", icon: ArrowUpFromLine },
    { label: "Pending Deposits", value: pendingDeposits.toLocaleString(), detail: "စောင့်ဆိုင်းနေသော ငွေသွင်းမှု", icon: Banknote },
    { label: "Pending Withdrawals", value: pendingWithdrawals.toLocaleString(), detail: "စောင့်ဆိုင်းနေသော ငွေထုတ်မှု", icon: WalletCards },
  ];
  const userStats = [
    { label: "Total Users", value: totalUserCount.toLocaleString(), detail: "စုစုပေါင်းအသုံးပြုသူအရေအတွက်", icon: Users },
    { label: "Active Today", value: userRows.filter((profile) => isTodayYangon(profile.last_login_at)).length.toLocaleString(), detail: "ယခုအသုံးပြုနေသူအရေအတွက်", icon: Activity },
    { label: "New Today", value: userRows.filter((profile) => isTodayYangon(profile.created_at)).length.toLocaleString(), detail: "ယနေ့ အသစ်စာရင်းသွင်းသူ", icon: CircleUserRound },
    { label: "Depositors", value: new Set(completedDeposits.map((request) => request.user_id)).size.toLocaleString(), detail: "ငွေသွင်းသူဦးရေ", icon: ArrowDownToLine },
    { label: "Total Deposit", value: money(completedDeposits.reduce((sum, request) => sum + Number(request.amount), 0)), detail: "အတည်ပြုပြီး ငွေသွင်းစုစုပေါင်း", icon: ArrowDownToLine },
    { label: "Withdrawers", value: new Set(completedWithdrawals.map((request) => request.user_id)).size.toLocaleString(), detail: "ငွေထုတ်ထားသူအရေအတွက်", icon: ArrowUpFromLine },
    { label: "Total Withdrawal", value: money(completedWithdrawals.reduce((sum, request) => sum + Number(request.amount), 0)), detail: "ငွေပို့ပြီး ငွေထုတ်စုစုပေါင်း", icon: ArrowUpFromLine },
  ];
  const transactionStats = [
    { label: "Total Deposit", value: money(completedDeposits.reduce((sum, request) => sum + Number(request.amount), 0)), detail: "အချိန်အားလုံး · Completed", icon: ArrowDownToLine },
    { label: "Total Withdrawal", value: money(completedWithdrawals.reduce((sum, request) => sum + Number(request.amount), 0)), detail: "အချိန်အားလုံး · Completed", icon: ArrowUpFromLine },
    { label: "Pending Deposit", value: pendingDeposits.toLocaleString(), detail: "စစ်ဆေးရန် ကျန်ရှိသည်", icon: Clock3 },
    { label: "Pending Withdrawal", value: pendingWithdrawals.toLocaleString(), detail: "အတည်ပြုရသေးပါ", icon: Clock3 },
  ];

  const downloadCsv = (filename: string, header: unknown[], rows: unknown[][]) => {
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  };
  const exportUsers = () => downloadCsv("tradex-demo-users.csv", ["User ID", "Username", "Name", "Email", "Phone", "Status", "Registered", "Balance"], filteredUsers.map((profile) => [profile.user_code, profile.username, profile.full_name, profile.email, profile.phone, profile.status, profile.created_at, profile.balance]));
  const exportPayouts = () => downloadCsv("tradex-withdrawal-accounts.csv", ["User ID", "Username", "Name", "Phone / Email", "Status", "Withdrawal account"], filteredPayoutUsers.map((profile) => [profile.user_code, profile.username, profile.full_name, profile.phone || profile.email, profile.status, payoutAccounts.some((account) => account.user_id === profile.id) ? "Linked" : "Not linked"]));
  const exportTransactions = () => downloadCsv("tradex-transactions.csv", ["Transaction ID", "Type", "User ID", "Amount MMK", "Method", "Created at", "Reviewed by", "Status"], filteredTransactions.map((request) => [request.id, request.type, profileById.get(request.user_id)?.user_code, request.amount, request.method, request.created_at, request.reviewed_by, request.status]));

  const approveRequest = async (action: "complete" | "approve" | "reject") => {
    if (!selectedRequest || !supabase) return;
    if (action === "reject" && statusReasonMissing(reviewReason)) { toast.error("Rejection reason is required"); return; }
    if (selectedRequest.type === "withdrawal" && action === "complete" && !transferReference.trim()) { toast.error("Transfer reference is required"); return; }
    const { error } = await (supabase as any).rpc("review_transaction_request", { p_request_id: selectedRequest.id, p_action: action, p_reason: reviewReason.trim() || null, p_reference: transferReference.trim() || null });
    if (error) { toast.error("Unable to review request. Verify the schema migration and permissions."); return; }
    toast.success(action === "complete" ? "Transaction completed" : action === "approve" ? "Withdrawal approved" : "Request rejected");
    setSelectedRequest(null); setReviewReason(""); setTransferReference(""); reload();
  };

  const changeUserStatus = async () => {
    if (!selectedUser || !supabase) return;
    if (statusReason.trim().length < 3) { toast.error("Please provide a reason for the status change"); return; }
    const { error } = await (supabase as any).rpc("admin_update_user_status", { p_user_id: selectedUser.id, p_status: statusDraft, p_reason: statusReason.trim() });
    if (error) { toast.error("Unable to update status. Check admin permissions."); return; }
    toast.success("Account status updated");
    setSelectedUser({ ...selectedUser, status: statusDraft }); reload();
  };

  const sendPasswordReset = async () => {
    if (!selectedUser?.email || !supabase) { toast.error("This account has no registered email for password recovery"); return; }
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, { redirectTo: `${window.location.origin}/login?reset=1` });
    setResetSending(false);
    if (error) { toast.error("Unable to send password recovery email"); return; }
    await (supabase as any).rpc("record_admin_audit", { p_action_type: "user.password_reset_initiated", p_target_id: selectedUser.id, p_reason: "Secure reset email initiated by admin", p_metadata: { delivery: "email" } });
    toast.success("Secure password reset instructions sent to the user");
  };

  const assignSubAdmin = async () => {
    const enteredIdentifier = roleIdentifier.trim();
    if (!enteredIdentifier || !supabase) { toast.error("Enter a registered email or User ID"); return; }
    const matchedProfile = userRows.find((profile) =>
      profile.email.toLowerCase() === enteredIdentifier.toLowerCase()
      || profile.user_code?.toLowerCase() === enteredIdentifier.toLowerCase()
      || profile.id.toLowerCase() === enteredIdentifier.toLowerCase()
    );
    const identifier = matchedProfile?.email || matchedProfile?.user_code || enteredIdentifier;
    const { error } = await (supabase as any).rpc("assign_sub_admin", { p_identifier: identifier });
    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      toast.error(message.includes("user not found")
        ? "No account matches that email or User ID."
        : "Could not add sub-admin. Verify the registered identifier and Owner permission.");
      return;
    }
    toast.success("Sub-admin role saved");
    setRoleIdentifier("");
    reload();
  };

  const removeSubAdmin = async (userId: string) => {
    if (!supabase) return;
    const { error } = await (supabase as any).rpc("remove_sub_admin", { p_user_id: userId });
    if (error) { toast.error("Could not revoke sub-admin access"); return; }
    toast.success("Sub-admin access removed"); reload();
  };

  const visibleTabs = canManageSubAdmins ? [...tabs, { id: "access" as const, label: "Sub-admin Access", icon: ShieldCheck }] : tabs;

  useEffect(() => {
    if (!canManageSubAdmins && activeTab === "access") setActiveTab("users");
  }, [activeTab, canManageSubAdmins]);

  if (!store.ready || loading) return <AdminLoading />;
  if (loadError && !authorized) return <AdminError message={loadError} onBack={() => navigate({ to: "/" })} />;
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-[#0d0f13] text-[#f1f3f8]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[#242835] bg-[#101217] px-4 py-6 lg:flex lg:flex-col">
        <div className="px-3"><p className="text-2xl font-extrabold tracking-tight">TRADE <span className="text-[#f04452]">X</span></p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#929eaf]">Admin workspace</p></div>
        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#687386]">Management</div>
        <nav className="mt-3 space-y-1">{visibleTabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${activeTab === id ? "bg-rose-500/10 text-[#f04452]" : "text-[#a4adbb] hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
        <div className="mt-auto rounded-2xl border border-[#242835] bg-[#161a24] p-4"><div className="flex items-center gap-2 text-xs font-bold"><span className="h-2 w-2 rounded-full bg-emerald-400" />Live workspace</div><p className="mt-2 text-xs text-[#929eaf]">Centralized Supabase data · all devices</p><p className="mt-3 text-[10px] uppercase tracking-widest text-[#687386]">Asia/Yangon · {formatTime(new Date(now).toISOString())}</p></div>
      </aside>

      <div className="lg:ml-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#242835] bg-[#0d0f13]/95 px-4 py-3 backdrop-blur sm:px-7">
          <div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#929eaf] lg:hidden">TRADE X · Admin workspace</p><p className="hidden text-sm text-[#929eaf] lg:block">Workspace <span className="mx-2">/</span><span className="text-[#f1f3f8]">{tabs.find((tab) => tab.id === activeTab)?.label ?? "Sub-admin Access"}</span></p></div>
          <div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-lg border border-[#f4c772]/20 bg-[#f4c772]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f4c772] sm:inline-flex">{activeTab === "users" ? "PUBLIC DEMO" : <><Clock3 className="mr-1.5 h-3.5 w-3.5" />Asia/Yangon</>}</span>{superAdmin ? <select aria-label="Role switcher" title="Role preview only; permissions remain tied to your Supabase role" value={rolePreview} onChange={(event) => { const nextRole = event.target.value as "owner" | "super_admin" | "sub_admin"; setRolePreview(nextRole); if (nextRole === "sub_admin" && activeTab === "access") setActiveTab("users"); }} className="h-9 rounded-lg border border-[#f04452]/20 bg-[#161a24] px-3 text-[10px] font-bold uppercase tracking-wider text-[#ff7781] outline-none"><option value="owner">Owner</option><option value="super_admin">Super Admin</option><option value="sub_admin">Sub-admin</option></select> : <span className="rounded-lg border border-[#f04452]/20 bg-[#f04452]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#ff7781]">{role === "sub_admin" ? "Sub-admin" : "Admin"}</span>}<span className="grid h-9 w-9 place-items-center rounded-full border border-[#f04452]/30 bg-[#f04452]/10 text-xs font-bold text-[#ff7781]">{(store.user?.email || store.user?.phone || "TX").slice(0,2).toUpperCase()}</span></div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-[#242835] bg-[#0d0f13] px-4 py-2 lg:hidden">{visibleTabs.map(({ id,label,icon:Icon }) => <button key={id} onClick={() => setActiveTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab===id ? "bg-rose-500/10 text-[#ff7781]" : "text-[#929eaf]"}`}><Icon className="h-4 w-4"/>{label}</button>)}</nav>
        <main className="space-y-6 px-4 py-6 sm:px-7">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#f4c772]">{role === "super_admin" ? "Full access" : "Authorized workspace"}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{activeTab === "users" ? "User Management" : activeTab === "payout" ? "Withdrawal Accounts" : activeTab === "transactions" ? "Transaction History" : activeTab === "logins" ? "Login History" : activeTab === "audit" ? "Admin Audit Logs" : "Sub-admin access management"}</h1><p className="mt-1 max-w-2xl text-sm text-[#929eaf]">{activeTab === "users" ? "User အားလုံးနှင့် စုစုပေါင်းစာရင်းများကို တစ်နေရာတည်းတွင် ကြည့်ပါ။" : activeTab === "payout" ? "ငွေထုတ်ရန် Account ချိတ်ထား / မထားကို ကြည့်ရှုရန်။" : activeTab === "transactions" ? "ငွေသွင်း / ထုတ် မှတ်တမ်းများနှင့် စစ်ဆေးမှုအခြေအနေ" : activeTab === "logins" ? "Login / Logout၊ Device နှင့် သံသယဖြစ်ဖွယ် ဝင်ရောက်မှုများ" : activeTab === "audit" ? "လုပ်ဆောင်မှု၊ အကြောင်းပြချက်၊ ဝန်ထမ်းနှင့် အချိန်မှတ်တမ်း" : "Shared roles are read from Supabase and apply across devices."}</p></div>{(activeTab === "users" || activeTab === "payout") && <button onClick={activeTab === "users" ? exportUsers : exportPayouts} className="inline-flex items-center gap-2 rounded-xl border border-[#2a2f3a] bg-[#161a24] px-4 py-2.5 text-sm font-semibold hover:border-[#f4c772]/40"><Download className="h-4 w-4"/>Export CSV</button>}</div>

          {(activeTab === "users" || activeTab === "transactions") && <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{(activeTab === "users" ? userStats : activeTab === "transactions" ? transactionStats : stats).map(({ label,value,detail,icon:Icon }) => <div key={label} className="min-h-28 rounded-2xl border border-[#242835] bg-[#13161f] p-4"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-[#a1aaba]">{label}</p><Icon className="h-4 w-4 shrink-0 text-[#f04452]"/></div><p className="mt-3 font-mono text-lg font-bold tracking-tight sm:text-xl">{value}</p><p className="mt-1 text-[10px] text-[#778294]">{detail}</p></div>)}</section>}

          {activeTab === "users" && <div className="text-xs text-[#929eaf]">● နမူနာဒေတာ · 18 Nov 2026 · Myanmar Time | ငွေစာရင်း: အချိန်အားလုံး / Completed သာ</div>}
          {!(["users", "payout", "transactions", "logins", "audit"] as TabId[]).includes(activeTab) && loadError && <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">{loadError}</p>}

          {activeTab === "users" && <section className="overflow-hidden rounded-2xl border border-[#242835] bg-[#13161f]"><div className="flex items-center justify-between gap-3 border-b border-[#242835] px-5 py-4"><h2 className="font-bold">All Users <span className="ml-1 rounded-md bg-white/10 px-2 py-1 text-xs text-[#aab3c1]">{filteredUsers.length}</span></h2><span className="text-[10px] font-semibold uppercase tracking-widest text-[#929eaf]">MASKED · SAMPLE DATA</span></div><div className="space-y-3 border-b border-[#242835] p-4"><label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-[#748093]"/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="User ID၊ Username၊ ဖုန်း / Email ဖြင့် ရှာရန်" className="h-10 w-full rounded-lg border border-[#2a2f3a] bg-[#0d0f13] pl-9 pr-3 text-sm outline-none focus:border-[#f4c772]/60"/></label><div className="grid gap-3 sm:grid-cols-2"><select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value)} className="h-10 min-w-0 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-3 text-xs"><option value="all">Account status အားလုံး</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="flagged">Locked</option><option value="disabled">Disabled</option></select><select value={payoutFilter} onChange={(event)=>setPayoutFilter(event.target.value)} className="h-10 min-w-0 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-3 text-xs"><option value="all">ငွေထုတ်အကောင့် အားလုံး</option><option value="linked">ချိတ်ထားသည်</option><option value="unlinked">မချိတ်ရသေး</option></select></div><div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-[#929eaf]">Register date မှ</span><input aria-label="Registration date from" type="date" value={dateFrom} onChange={(event)=>setDateFrom(event.target.value)} className="h-9 min-w-0 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-2"/><span className="text-[#929eaf]">အထိ</span><input aria-label="Registration date to" type="date" value={dateTo} onChange={(event)=>setDateTo(event.target.value)} className="h-9 min-w-0 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-2"/><button onClick={()=>{setSearch("");setStatusFilter("all");setPayoutFilter("all");setDateFrom("");setDateTo("");}} className="ml-auto text-xs font-semibold text-rose-300 hover:text-rose-200">Filter ရှင်းမယ်</button></div></div><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{filteredUsers.map((profile)=>{const fullName=profile.full_name||profile.username||"Member";const initials=fullName.split(/\s+/).slice(0,2).map((part)=>part[0]).join("").toUpperCase();const linked=payoutAccounts.some((account)=>account.user_id===profile.id);return <article key={profile.id} className="rounded-xl border border-[#242835] bg-[#10131a] p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25364a] text-xs font-bold text-[#d5dfed]">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{fullName}</p><p className="truncate text-xs text-[#929eaf]">@{profile.username||profile.user_code||"member"}</p></div><button onClick={()=>{setSelectedUser(profile);setDetailTab("Profile");}} aria-label={`View ${fullName} details`} className="rounded-lg border border-[#343b49] px-2.5 py-2 text-xs font-semibold text-[#c5ccd7] hover:border-[#f4c772]/50">Details <ChevronRight className="ml-1 inline h-3 w-3"/></button></div><div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-[#242835] pt-4">{[["USER ID",profile.user_code||"—"],["PHONE / EMAIL",maskContact(profile)],["REGISTER DATE",formatCardDate(profile.created_at)],["STATUS",profile.status||"active"],["LAST LOGIN",formatCardDate(profile.last_login_at)],["BALANCE",money(Number(profile.balance||0))],["WITHDRAWAL ACCOUNT",linked?"ချိတ်ထားသည်":"မချိတ်ရသေး"]].map(([label,value])=><div key={label} className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-wider text-[#778294]">{label}</p><div className="mt-1 break-words text-xs font-medium text-[#d8deea]">{label==="STATUS"?<StatusBadge value={value||"—"}/>:label==="WITHDRAWAL ACCOUNT"?<span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold ${linked?"bg-emerald-500/10 text-emerald-400":"bg-white/5 text-[#929eaf]"}`}>{value}</span>:label==="BALANCE"?<span className="font-bold text-white">{value}</span>:value}</div></div>)}</div></article>;})}{filteredUsers.length===0&&<p className="col-span-full py-10 text-center text-sm text-[#929eaf]">No users match these filters.</p>}</div></section>}

          {activeTab === "payout" && <PayoutAccountsView profiles={filteredPayoutUsers} payoutAccounts={payoutAccounts} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} payoutFilter={payoutFilter} setPayoutFilter={setPayoutFilter} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} onReset={() => { setSearch(""); setStatusFilter("all"); setPayoutFilter("all"); setDateFrom(""); setDateTo(""); }} />}

          {activeTab === "transactions" && <TransactionsView requestView={requestView} setRequestView={setRequestView} requestStatus={requestStatus} setRequestStatus={setRequestStatus} search={search} setSearch={setSearch} requests={filteredTransactions} profileById={profileById} onExport={exportTransactions} onReview={(request) => { setSelectedRequest(request); setReviewReason(""); setTransferReference(""); }} />}

          {activeTab === "logins" && <LoginHistoryView rows={filteredLoginRows} profileById={profileById} status={loginStatus} setStatus={setLoginStatus} />}

          {activeTab === "audit" && <AuditLogsView rows={filteredAuditRows} profileById={profileById} search={auditSearch} setSearch={setAuditSearch} />}

          {activeTab === "access" && canManageSubAdmins && <section className="space-y-5"><div className="rounded-2xl border border-[#242835] bg-[#13161f] p-5"><h2 className="font-bold">Sub-admin access management</h2><p className="mt-1 text-sm text-[#929eaf]">Roles are assigned in Supabase and immediately apply to the account on every device.</p><form onSubmit={(event)=>{event.preventDefault();void assignSubAdmin();}} className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="sub-admin-identifier">Email or User ID</label><input id="sub-admin-identifier" type="text" autoComplete="off" value={roleIdentifier} onChange={(event)=>setRoleIdentifier(event.target.value)} placeholder="Email or User ID (e.g. U1001)" className="h-11 min-w-0 flex-1 rounded-xl border border-[#2a2f3a] bg-[#0d0f13] px-3 text-sm outline-none focus:border-[#f4c772]/60"/><button type="submit" className="rounded-xl bg-[#f4c772] px-5 py-2.5 text-sm font-bold text-[#17140d]">Add Sub-admin</button></form></div><div className="overflow-hidden rounded-2xl border border-[#242835] bg-[#13161f]"><div className="border-b border-[#242835] p-5 font-bold">Current elevated roles</div><DataTable headers={["Staff","User ID","Role","Granted","Action"]} empty={!roleRows.some((row)=>row.role==="sub_admin")}>{roleRows.filter((row)=>row.role==="sub_admin").map((row)=>{const profile=profileById.get(row.user_id);return <tr key={`${row.user_id}-${row.role}`} className="border-t border-[#242835]"><td className="px-4 py-3 text-sm">{profile?.full_name||profile?.email||row.user_id}</td><td className="px-4 py-3 font-mono text-xs">{profile?.user_code||"—"}</td><td className="px-4 py-3"><StatusBadge value={row.role}/></td><td className="whitespace-nowrap px-4 py-3 text-xs">{formatTime(row.created_at)}</td><td className="px-4 py-3">{row.role==="sub_admin"?<button onClick={()=>removeSubAdmin(row.user_id)} className="rounded-lg border border-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-300">Revoke</button>:"Protected"}</td></tr>;})}</DataTable></div></section>}
        </main>
      </div>

      {selectedUser && <UserDetailsModal profile={selectedUser} detailTab={detailTab} setDetailTab={setDetailTab} onClose={()=>setSelectedUser(null)} onStatusChanged={changeUserStatus} statusDraft={statusDraft} setStatusDraft={setStatusDraft} reason={statusReason} setReason={setStatusReason} sendingReset={resetSending} sendReset={sendPasswordReset} payouts={detailPayouts} transactions={detailRequests} bets={detailBets} logins={detailLogins} audit={detailAudit} referrals={referralCount} />}
      {selectedRequest && <RequestReviewModal request={selectedRequest} user={profileById.get(selectedRequest.user_id)} onClose={()=>setSelectedRequest(null)} onAction={approveRequest} reason={reviewReason} setReason={setReviewReason} reference={transferReference} setReference={setTransferReference} />}
    </div>
  );
}

function statusReasonMissing(reason: string) { return reason.trim().length < 3; }
function AdminLoading() { return <main className="grid min-h-screen place-items-center bg-[#0d0f13] text-[#929eaf]"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#242835] border-t-[#f4c772]"/><p className="mt-4 text-sm">Verifying secure admin access…</p></div></main>; }
function AdminError({message,onBack}:{message:string;onBack:()=>void}) { return <main className="grid min-h-screen place-items-center bg-[#0d0f13] px-4 text-[#f1f3f8]"><div className="max-w-md rounded-2xl border border-[#242835] bg-[#13161f] p-6 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-rose-400"/><h1 className="mt-3 text-xl font-bold">Admin access unavailable</h1><p className="mt-2 text-sm text-[#929eaf]">{message}</p><button onClick={onBack} className="mt-5 rounded-xl bg-[#1e2330] px-4 py-2 text-sm">Back to app</button></div></main>; }
function StatusBadge({value}:{value:string}) { return <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold capitalize ${statusClass(value)}`}>{value.replaceAll("_"," ")}</span>; }
function statusClass(status:string) { return status==="active"||status==="completed"||status==="verified"||status==="won"?"border-emerald-500/20 bg-emerald-500/10 text-emerald-400":status==="flagged"||status==="failed"||status==="rejected"||status==="lost"?"border-rose-500/20 bg-rose-500/10 text-rose-400":"border-amber-400/20 bg-amber-400/10 text-amber-300"; }
function formatTime(value?:string|null) { return value?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Yangon",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(value)).replace(",",""):"—"; }
function isTodayYangon(value?:string|null) { if(!value)return false; const format=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Yangon",year:"numeric",month:"2-digit",day:"2-digit"}).format(date); return format(new Date(value))===format(new Date()); }
function maskContact(profile:ProfileRow) { if(profile.phone)return `${profile.phone.slice(0,3)}••••${profile.phone.slice(-3)}`; return profile.email.replace(/^(.{2}).*(@.*)$/,"$1•••$2"); }
function formatCardDate(value?:string|null) { return value?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Yangon",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value)):"—"; }
function DataTable({headers,children,empty}:{headers:string[];children:ReactNode;empty:boolean}) { return <div className="overflow-x-auto"><table className="min-w-[980px] w-full border-collapse text-left"><thead className="bg-[#10131a] text-[9px] uppercase tracking-wider text-[#7e899a]"><tr>{headers.map((header)=><th key={header} className="whitespace-nowrap px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{children}</tbody>{empty&&<tfoot><tr><td colSpan={headers.length} className="p-10 text-center text-sm text-[#929eaf]">No data found.</td></tr></tfoot>}</table></div>; }

function UserDetailsModal({profile,detailTab,setDetailTab,onClose,onStatusChanged,statusDraft,setStatusDraft,reason,setReason,sendingReset,sendReset,payouts,transactions,bets,logins,audit,referrals}:{profile:ProfileRow;detailTab:DetailTab;setDetailTab:(tab:DetailTab)=>void;onClose:()=>void;onStatusChanged:()=>void;statusDraft:string;setStatusDraft:(status:string)=>void;reason:string;setReason:(reason:string)=>void;sendingReset:boolean;sendReset:()=>void;payouts:PayoutRow[];transactions:WalletRow[];bets:BetRow[];logins:LoginRow[];audit:AuditRow[];referrals:number}) {
  const [resetConfirm,setResetConfirm]=useState(false);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}><section onClick={(event)=>event.stopPropagation()} className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-t-3xl border border-[#2a2f3a] bg-[#101319] shadow-2xl sm:rounded-3xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#242835] bg-[#101319]/95 p-5 backdrop-blur"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f4c772]">User profile · {profile.user_code||profile.id.slice(0,8)}</p><h2 className="mt-1 text-xl font-bold">{profile.full_name||profile.username||"Member"}</h2><p className="mt-1 text-xs text-[#929eaf]">{maskContact(profile)}</p></div><button onClick={onClose} aria-label="Close user details" className="rounded-lg p-2 text-[#929eaf] hover:bg-white/5"><X className="h-5 w-5"/></button></header><div className="flex gap-1 overflow-x-auto border-b border-[#242835] px-4">{detailTabs.map((tab)=><button key={tab} onClick={()=>setDetailTab(tab)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${tab===detailTab?"border-[#f04452] text-white":"border-transparent text-[#929eaf]"}`}>{tab}</button>)}</div><div className="p-5">{detailTab==="Profile"&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["User ID",profile.user_code],["Username",profile.username],["Name",profile.full_name],["Phone",profile.phone],["Email",profile.email],["Register date",formatTime(profile.created_at)],["Status",profile.status],["Last login",formatTime(profile.last_login_at)],["Device info",profile.device_info]].map(([label,value])=><InfoCard key={label||""} label={label||""} value={value||"—"}/>)}</div>}
{detailTab==="Account Status"&&<div className="grid gap-6 lg:grid-cols-2"><div className="space-y-4 rounded-2xl border border-[#242835] bg-[#13161f] p-4"><h3 className="font-bold">Change account status</h3><label className="block text-xs text-[#929eaf]">Status<select value={statusDraft} onChange={(event)=>setStatusDraft(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-3 text-sm text-white"><option value="active">Active</option><option value="suspended">Suspended</option><option value="flagged">Flagged</option></select></label><label className="block text-xs text-[#929eaf]">ဘာကြောင့် ပြောင်းလဲသည်ကို ရေးပါ<textarea value={reason} onChange={(event)=>setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-[#2a2f3a] bg-[#0d0f13] p-3 text-sm text-white"/></label><button onClick={onStatusChanged} className="w-full rounded-xl bg-[#f04452] px-4 py-3 text-sm font-bold text-white">Save status with audit reason</button></div><div className="space-y-4 rounded-2xl border border-[#242835] bg-[#13161f] p-4"><div><h3 className="font-bold">Secure Password Reset</h3><p className="mt-1 text-xs text-[#929eaf]">Send a recovery link to the user&apos;s registered email. Admins never view or set passwords.</p></div><button disabled={sendingReset||!profile.email} onClick={()=>setResetConfirm(true)} className="rounded-xl border border-[#343b49] px-4 py-3 text-sm font-semibold disabled:opacity-50">{sendingReset?"Sending…":"Send secure reset email"}</button>{resetConfirm&&<div className="rounded-xl border border-[#f4c772]/20 bg-[#f4c772]/5 p-3 text-xs"><p>Send reset instructions to {maskContact(profile)}?</p><div className="mt-3 flex gap-2"><button onClick={()=>{setResetConfirm(false);sendReset();}} className="rounded-lg bg-[#f4c772] px-3 py-2 font-bold text-[#17140d]">Confirm send</button><button onClick={()=>setResetConfirm(false)} className="rounded-lg bg-white/5 px-3 py-2">Cancel</button></div></div>}</div><div className="lg:col-span-2"><h3 className="mb-3 font-bold">Status history</h3><DataTable headers={["TIME","BEFORE","AFTER","STAFF","REASON"]} empty={!audit.some((item)=>item.action_type==="user.status_change")}>{audit.filter((item)=>item.action_type==="user.status_change").map((item)=><tr key={item.id} className="border-t border-[#242835]"><td className="px-4 py-3 text-xs">{formatTime(item.created_at)}</td><td className="px-4 py-3 text-xs">{String(item.metadata?.["before"]||"—")}</td><td className="px-4 py-3 text-xs">{String(item.metadata?.["after"]||"—")}</td><td className="px-4 py-3 text-xs">{item.staff_email}</td><td className="px-4 py-3 text-xs">{item.reason}</td></tr>)}</DataTable></div></div>}
{detailTab==="Payout Account"&&<DataTable headers={["Method","Account holder","Account number","Linked date","Verification"]} empty={!payouts.length}>{payouts.map((item)=><tr key={item.id} className="border-t border-[#242835]"><td className="px-4 py-3 text-sm">{item.method}</td><td className="px-4 py-3 text-sm">{item.account_name}</td><td className="px-4 py-3 font-mono text-sm">{item.account_number}</td><td className="px-4 py-3 text-xs">{formatTime(item.linked_at)}</td><td className="px-4 py-3"><StatusBadge value={item.verification_status}/></td></tr>)}</DataTable>}
{detailTab==="Wallet Overview"&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["Available Balance",profile.balance],["Frozen Balance",profile.frozen_balance],["Total Deposit",profile.total_deposit],["Total Withdrawal",profile.total_withdrawal],["Security held amount · လုံခြုံရေးအတွက် ထိန်းထားသောငွေ",profile.frozen_balance],["Total Bonus",profile.total_bonus]].map(([label,value])=><InfoCard key={String(label)} label={String(label)} value={money(Number(value||0))}/>)}</div>}
{detailTab==="Transactions"&&<DataTable headers={["Type","Detail","Amount","Time"]} empty={!transactions.length}>{transactions.map((item)=><tr key={item.id} className="border-t border-[#242835]"><td className="px-4 py-3"><StatusBadge value={item.kind}/></td><td className="px-4 py-3 text-sm">{item.detail}</td><td className={`px-4 py-3 font-mono text-sm ${Number(item.amount)>=0?"text-emerald-400":"text-rose-400"}`}>{money(Number(item.amount))}</td><td className="px-4 py-3 text-xs">{formatTime(item.created_at)}</td></tr>)}</DataTable>}
{detailTab==="Bets"&&<DataTable headers={["Round ID","Market","Side","Duration","Result","Win/Lose","Bet amount","Return","Profit/Loss","Time"]} empty={!bets.length}>{bets.map((item)=><tr key={item.id} className="border-t border-[#242835]"><td className="px-4 py-3 font-mono text-xs">{item.round_id}</td><td className="px-4 py-3 text-xs">{item.market_id}</td><td className="px-4 py-3 text-xs uppercase">{item.side}</td><td className="px-4 py-3 text-xs">{item.duration_seconds}s</td><td className="px-4 py-3 text-xs uppercase">{item.result||"Pending"}</td><td className="px-4 py-3"><StatusBadge value={item.status}/></td><td className="px-4 py-3 font-mono text-xs">{money(Number(item.amount))}</td><td className="px-4 py-3 font-mono text-xs">{money(Number(item.payout))}</td><td className="px-4 py-3 font-mono text-xs">{money(Number(item.profit_loss))}</td><td className="px-4 py-3 text-xs">{formatTime(item.created_at)}</td></tr>)}</DataTable>}
{detailTab==="Logins"&&<DataTable headers={["User ID","Time","Device","IP","Status","Logout time","Risk flag"]} empty={!logins.length}>{logins.map((item)=><tr key={item.id} className="border-t border-[#242835]"><td className="px-4 py-3 font-mono text-xs">{profile.user_code||"—"}</td><td className="px-4 py-3 text-xs">{formatTime(item.login_at)}</td><td className="px-4 py-3 text-xs">{item.device||"—"}</td><td className="px-4 py-3 font-mono text-xs">{item.ip_address||"—"}</td><td className="px-4 py-3"><StatusBadge value={item.status}/></td><td className="px-4 py-3 text-xs">{formatTime(item.logout_at)}</td><td className="px-4 py-3 text-xs">{item.risk_flag||"—"}</td></tr>)}</DataTable>}
{detailTab==="Referral"&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><InfoCard label="Referral code" value={profile.referral_code||"—"}/><InfoCard label="Referred by" value={profile.referred_by||"Direct"}/><InfoCard label="Total invited users" value={String(referrals)}/><InfoCard label="Total commission earned" value={money(transactions.filter((item)=>item.kind==="commission").reduce((sum,item)=>sum+Number(item.amount),0))}/></div>}</div></section></div>;
}

function InfoCard({label,value}:{label:string;value:string}) { return <div className="rounded-xl border border-[#242835] bg-[#13161f] p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#7e899a]">{label}</p><p className="mt-2 break-all text-sm font-medium text-[#e6eaf1]">{value}</p></div>; }

function RequestReviewModal({request,user,onClose,onAction,reason,setReason,reference,setReference}:{request:RequestRow;user:ProfileRow|undefined;onClose:()=>void;onAction:(action:"complete"|"approve"|"reject")=>void;reason:string;setReason:(value:string)=>void;reference:string;setReference:(value:string)=>void}) {
  const deposit=request.type==="deposit";
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}><section onClick={(event)=>event.stopPropagation()} className="w-full max-w-xl rounded-t-3xl border border-[#2a2f3a] bg-[#101319] p-5 sm:rounded-3xl"><header className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#f4c772]">Review {request.type}</p><h2 className="mt-1 text-xl font-bold">{money(Number(request.amount))}</h2><p className="mt-1 text-xs text-[#929eaf]">{user?.user_code||request.user_id} · {request.method} · {formatTime(request.created_at)}</p></div><button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[#929eaf] hover:bg-white/5"><X className="h-5 w-5"/></button></header><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#161a24] p-4 text-xs"><p><span className="text-[#7e899a]">Sender / Recipient</span><br/>{request.sender_account||request.recipient_name||"—"}</p><p><span className="text-[#7e899a]">Receiver / Account</span><br/>{request.receiver_account||request.recipient_account||"—"}</p><p><span className="text-[#7e899a]">Slip last 5</span><br/>{request.slip_last5||"—"}</p>{request.receipt_url&&<a className="text-[#f4c772] underline" href={request.receipt_url} target="_blank" rel="noreferrer">View receipt</a>}</div>{!deposit&&request.status==="approved"&&<label className="mt-4 block text-xs text-[#929eaf]">ငွေလွှဲအတည်ပြုနံပါတ် / Transaction Reference Number<input value={reference} onChange={(event)=>setReference(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-3 text-sm text-white"/></label>}{(!deposit&&request.status==="pending"||deposit)&&<label className="mt-4 block text-xs text-[#929eaf]">Reject reason<textarea value={reason} onChange={(event)=>setReason(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-[#2a2f3a] bg-[#0d0f13] p-3 text-sm text-white"/></label>}<div className="mt-5 flex flex-wrap justify-end gap-2">{deposit&&<><button onClick={()=>onAction("reject")} className="rounded-xl border border-rose-500/30 px-4 py-2.5 text-sm font-semibold text-rose-300">Failed မှတ်ချက်</button><button onClick={()=>onAction("complete")} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-[#07130b]">ငွေဝင်မှု အတည်ပြုမယ်</button></>}{!deposit&&request.status==="pending"&&<><button onClick={()=>onAction("reject")} className="rounded-xl border border-rose-500/30 px-4 py-2.5 text-sm font-semibold text-rose-300">Reject · ငြင်းပယ်မယ်</button><button onClick={()=>onAction("approve")} className="rounded-xl bg-[#f4c772] px-4 py-2.5 text-sm font-bold text-[#17140d]">Approve · အတည်ပြုမယ်</button></>}{!deposit&&request.status==="approved"&&<><button onClick={()=>onAction("reject")} className="rounded-xl border border-rose-500/30 px-4 py-2.5 text-sm font-semibold text-rose-300">Reject · ပြန်အမ်းမယ်</button><button onClick={()=>onAction("complete")} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-[#07130b]">ငွေပို့ပြီး · Completed</button></>}</div></section></div>;
}
