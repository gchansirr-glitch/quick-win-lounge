import { Download, Search } from "lucide-react";
import { money } from "@/lib/store";

type ProfileRow = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  user_code: string | null;
  status: string;
  created_at: string;
};

type PayoutRow = { user_id: string };
type RequestRow = {
  id: string;
  user_id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  method: string;
  sender_account: string | null;
  sender_name: string | null;
  receiver_account: string | null;
  recipient_name: string | null;
  recipient_account: string | null;
  slip_last5: string | null;
  receipt_url: string | null;
  status: string;
  reason: string | null;
  transfer_reference: string | null;
  reviewed_by: string | null;
  created_at: string;
};

type PayoutAccountsViewProps = {
  profiles: ProfileRow[];
  payoutAccounts: PayoutRow[];
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  payoutFilter: string;
  setPayoutFilter: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  onReset: () => void;
};

export function PayoutAccountsView({
  profiles,
  payoutAccounts,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  payoutFilter,
  setPayoutFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onReset,
}: PayoutAccountsViewProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#242835] bg-[#13161f]">
      <header className="flex items-center justify-between gap-3 border-b border-[#242835] px-5 py-4">
        <h2 className="font-bold">
          ငွေထုတ်အကောင့်များ <span className="ml-1 rounded-md bg-white/10 px-2 py-1 text-xs text-[#aab3c1]">{profiles.length}</span>
        </h2>
        <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-[#929eaf]">MASKED · SAMPLE DATA</span>
      </header>
      <div className="space-y-3 border-b border-[#242835] p-4">
        <label className="relative block">
          <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-[#748093]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="User ID၊ Username၊ ဖုန်း / Email ဖြင့် ရှာရန်"
            className="h-10 w-full rounded-lg border border-[#2a2f3a] bg-[#0d0f13] pl-9 pr-3 text-sm outline-none focus:border-[#f4c772]/60"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <select aria-label="Account status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 min-w-0 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-3 text-xs">
            <option value="all">Account status အားလုံး</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="flagged">Locked</option>
            <option value="disabled">Disabled</option>
          </select>
          <select aria-label="Withdrawal account filter" value={payoutFilter} onChange={(event) => setPayoutFilter(event.target.value)} className="h-10 min-w-0 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-3 text-xs">
            <option value="all">ငွေထုတ်အကောင့် အားလုံး</option>
            <option value="linked">ချိတ်ထားသည်</option>
            <option value="unlinked">မချိတ်ရသေး</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#929eaf]">Register date မှ</span>
          <input aria-label="Registration date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 min-w-0 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-2" />
          <span className="text-[#929eaf]">အထိ</span>
          <input aria-label="Registration date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 min-w-0 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-2" />
          <button onClick={onReset} className="ml-auto text-xs font-semibold text-rose-300 hover:text-rose-200">Filter ရှင်းမယ်</button>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((profile) => {
          const name = profile.full_name || profile.username || "Member";
          const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
          const linked = payoutAccounts.some((account) => account.user_id === profile.id);
          return (
            <article key={profile.id} className="rounded-xl border border-[#242835] bg-[#10131a] p-4">
              <div className="flex items-center gap-3">
                <div aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#25364a] text-xs font-bold text-[#d5dfed]">{initials}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{name}</p>
                  <p className="truncate text-xs text-[#929eaf]">@{profile.username || profile.user_code || "member"}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-[#242835] pt-4">
                <CardField label="USER ID" value={profile.user_code || "—"} />
                <CardField label="PHONE / EMAIL" value={maskProfileContact(profile)} />
                <CardField label="REGISTER DATE" value={formatDateOnly(profile.created_at)} />
                <CardField label="STATUS" value={profile.status || "active"} badge="status" />
                <CardField label="WITHDRAWAL ACCOUNT" value={linked ? "ချိတ်ထားသည်" : "မချိတ်ရသေး"} badge={linked ? "linked" : "unlinked"} />
              </div>
            </article>
          );
        })}
        {profiles.length === 0 && <p className="col-span-full py-10 text-center text-sm text-[#929eaf]">ကိုက်ညီသောအကောင့် မတွေ့ပါ။</p>}
      </div>
    </section>
  );
}

type TransactionsViewProps = {
  requestView: "deposit" | "withdrawal";
  setRequestView: (value: "deposit" | "withdrawal") => void;
  requestStatus: string;
  setRequestStatus: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  requests: RequestRow[];
  profileById: Map<string, ProfileRow>;
  onExport: () => void;
  onReview: (request: RequestRow) => void;
};

export function TransactionsView({
  requestView,
  setRequestView,
  requestStatus,
  setRequestStatus,
  search,
  setSearch,
  requests,
  profileById,
  onExport,
  onReview,
}: TransactionsViewProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#242835] bg-[#13161f]">
      <nav aria-label="Transaction type" className="flex border-b border-[#242835] px-4">
        <button onClick={() => { setRequestView("deposit"); setRequestStatus("all"); }} className={`border-b-2 px-4 py-4 text-sm font-semibold ${requestView === "deposit" ? "border-[#f04452] text-white" : "border-transparent text-[#929eaf]"}`}>Deposit · ငွေသွင်း</button>
        <button onClick={() => { setRequestView("withdrawal"); setRequestStatus("all"); }} className={`border-b-2 px-4 py-4 text-sm font-semibold ${requestView === "withdrawal" ? "border-[#f04452] text-white" : "border-transparent text-[#929eaf]"}`}>Withdrawal · ငွေထုတ်</button>
      </nav>
      <div className="grid gap-3 border-b border-[#242835] p-4 md:grid-cols-[minmax(220px,1fr)_200px_auto]">
        <label className="relative block">
          <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-[#748093]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Transaction ID / User ID" className="h-10 w-full rounded-lg border border-[#2a2f3a] bg-[#0d0f13] pl-9 pr-3 text-sm outline-none focus:border-[#f4c772]/60" />
        </label>
        <select aria-label="Transaction status filter" value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)} className="h-10 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-3 text-xs">
          <option value="all">Status အားလုံး</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={onExport} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-4 text-xs font-semibold hover:border-[#f4c772]/50"><Download aria-hidden="true" className="h-4 w-4" />CSV</button>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {requests.map((request) => {
          const profile = profileById.get(request.user_id);
          const idPrefix = request.type === "deposit" ? "DP" : "WD";
          const displayId = `${idPrefix}${request.id.slice(0, 4).toUpperCase()}`;
          const status = request.status === "approved" || request.status === "pending" ? "Pending" : request.status === "failed" || request.status === "rejected" ? "Rejected" : request.status.slice(0, 1).toUpperCase() + request.status.slice(1);
          return (
            <article key={request.id} className="rounded-xl border border-[#242835] bg-[#10131a] p-4">
              <header className="border-b border-[#242835] pb-3">
                <p className="font-mono text-sm font-bold text-[#f04452]">{displayId}</p>
              </header>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
                <CardField label="USER ID" value={profile?.user_code || request.user_id.slice(0, 8)} />
                <CardField label="AMOUNT" value={money(Number(request.amount))} strong />
                <CardField label="METHOD" value={request.method} />
                <CardField label="TIME" value={formatDateTime(request.created_at)} />
                <CardField label="REVIEWED BY" value={request.reviewed_by ? request.reviewed_by.slice(0, 8) : "မစစ်ဆေးရသေး"} />
                <CardField label="STATUS" value={status} badge={request.status === "completed" ? "completed" : request.status === "rejected" || request.status === "failed" ? "rejected" : "pending"} />
              </div>
              <button onClick={() => onReview(request)} className="mt-4 w-full rounded-lg border border-[#343b49] px-4 py-2.5 text-sm font-semibold hover:border-[#f4c772]/50">အသေးစိတ် ↗</button>
            </article>
          );
        })}
        {requests.length === 0 && <p className="col-span-full py-10 text-center text-sm text-[#929eaf]">ကိုက်ညီသောစာရင်း မတွေ့ပါ။</p>}
      </div>
    </section>
  );
}

function CardField({ label, value, badge, strong }: { label: string; value: string; badge?: "status" | "linked" | "unlinked" | "completed" | "pending" | "rejected" | "success" | "failed" | "suspended"; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#778294]">{label}</p>
      <div className={`mt-1 break-words text-xs ${strong ? "font-bold text-white" : "font-medium text-[#d8deea]"}`}>
        {badge ? <StatusBadge value={badge === "linked" ? "ချိတ်ထားသည်" : badge === "unlinked" ? "မချိတ်ရသေး" : badge === "status" ? value : value} variant={badge} /> : value}
      </div>
    </div>
  );
}

function StatusBadge({ value, variant }: { value: string; variant?: "status" | "linked" | "unlinked" | "completed" | "pending" | "rejected" | "success" | "failed" | "suspended" }) {
  const color = variant === "linked" || variant === "completed" || variant === "success" || variant === "status" && value === "active"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
    : variant === "unlinked"
      ? "border-white/10 bg-white/5 text-[#929eaf]"
      : variant === "rejected" || variant === "failed"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
        : "border-amber-400/20 bg-amber-400/10 text-amber-300";
  return <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold ${color}`}>{value}</span>;
}

function maskProfileContact(profile: ProfileRow) {
  if (profile.phone) return `${profile.phone.slice(0, 3)}••••${profile.phone.slice(-3)}`;
  return profile.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

type LoginRow = {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  device: string | null;
  ip_address: string | null;
  status: string;
  risk_flag: string | null;
};

type AuditRow = {
  id: string;
  staff_id: string | null;
  staff_email: string;
  action_type: string;
  target_id: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function LoginHistoryView({ rows, profileById, status, setStatus }: { rows: LoginRow[]; profileById: Map<string, ProfileRow>; status: string; setStatus: (value: string) => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#242835] bg-[#13161f]">
      <div className="border-b border-[#242835] p-4">
        <label className="sr-only" htmlFor="login-status-filter">Login status filter</label>
        <select id="login-status-filter" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 min-w-52 rounded-lg border border-[#2a2f3a] bg-[#0d0f13] px-3 text-xs text-[#f1f3f8]">
          <option value="all">Login Status အားလုံး</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => {
          const profile = profileById.get(row.user_id);
          const isSuspended = row.status === "suspended" || profile?.status === "suspended";
          const statusLabel = isSuspended ? "Suspended" : row.status === "success" ? "Success" : "Failed";
          return (
            <article key={row.id} className="rounded-xl border border-[#242835] bg-[#10131a] p-4">
              <header className="flex items-center justify-between gap-3 border-b border-[#242835] pb-3">
                <div><p className="text-[9px] font-semibold uppercase tracking-wider text-[#778294]">USER ID</p><p className="mt-1 font-mono text-sm font-bold text-[#f1f3f8]">{profile?.user_code || row.user_id.slice(0, 8)}</p></div>
                <StatusBadge value={statusLabel} variant={isSuspended ? "suspended" : row.status === "success" ? "success" : "failed"} />
              </header>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
                <CardField label="LOGIN TIME" value={formatDateTime(row.login_at)} />
                <CardField label="DEVICE" value={row.device || "Unknown device"} />
                <CardField label="IP ADDRESS" value={row.ip_address || "—"} />
                <CardField label="STATUS" value={statusLabel} badge={isSuspended ? "suspended" : row.status === "success" ? "success" : "failed"} />
                <CardField label="LOGOUT TIME" value={row.logout_at ? formatDateTime(row.logout_at) : "ဝင်ထားဆဲ"} />
                <CardField label="RISK STATUS" value={row.risk_flag || "No risk flagged"} badge={row.risk_flag ? "rejected" : "success"} />
              </div>
            </article>
          );
        })}
        {rows.length === 0 && <p className="col-span-full py-10 text-center text-sm text-[#929eaf]">ကိုက်ညီသော Login မှတ်တမ်း မတွေ့ပါ။</p>}
      </div>
    </section>
  );
}

export function AuditLogsView({ rows, profileById, search, setSearch }: { rows: AuditRow[]; profileById: Map<string, ProfileRow>; search: string; setSearch: (value: string) => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#242835] bg-[#13161f]">
      <div className="border-b border-[#242835] p-4">
        <label className="relative block">
          <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-[#748093]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="User ID၊ ဝန်ထမ်း၊ Action ဖြင့် ရှာရန်" className="h-10 w-full rounded-lg border border-[#2a2f3a] bg-[#0d0f13] pl-9 pr-3 text-sm outline-none focus:border-[#f4c772]/60" />
        </label>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="bg-[#10131a] text-[9px] uppercase tracking-wider text-[#7e899a]"><tr>{["TIMESTAMP", "TARGET USER", "ACTION", "CHANGES", "STAFF", "REASON"].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <AuditTableRow key={row.id} row={row} profile={row.target_id ? profileById.get(row.target_id) : undefined} />)}</tbody>
        </table>
        {rows.length === 0 && <p className="p-10 text-center text-sm text-[#929eaf]">ကိုက်ညီသော Audit မှတ်တမ်း မတွေ့ပါ။</p>}
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        {rows.map((row) => <AuditCard key={row.id} row={row} profile={row.target_id ? profileById.get(row.target_id) : undefined} />)}
        {rows.length === 0 && <p className="py-10 text-center text-sm text-[#929eaf]">ကိုက်ညီသော Audit မှတ်တမ်း မတွေ့ပါ။</p>}
      </div>
    </section>
  );
}

function AuditTableRow({ row, profile }: { row: AuditRow; profile: ProfileRow | undefined }) {
  return <tr className="border-t border-[#242835]"><td className="whitespace-nowrap px-4 py-3 text-xs text-[#c5ccd7]">{formatDateTime(row.created_at)}</td><td className="px-4 py-3 text-xs">{profile?.user_code || row.target_id || "—"}{profile?.full_name ? <span className="mt-1 block text-[10px] text-[#929eaf]">{profile.full_name}</span> : null}</td><td className="px-4 py-3 font-mono text-xs text-[#f4c772]">{row.action_type}</td><td className="px-4 py-3 text-xs">{formatAuditChanges(row.metadata)}</td><td className="px-4 py-3 text-xs">{row.staff_email || "—"}</td><td className="max-w-sm px-4 py-3 text-xs text-[#929eaf]">{row.reason || "—"}</td></tr>;
}

function AuditCard({ row, profile }: { row: AuditRow; profile: ProfileRow | undefined }) {
  return (
    <article className="rounded-xl border border-[#242835] bg-[#10131a] p-4">
      <header className="flex items-start justify-between gap-3 border-b border-[#242835] pb-3"><p className="font-mono text-xs font-bold text-[#f4c772]">{row.action_type}</p><time className="text-right text-[10px] text-[#929eaf]">{formatDateTime(row.created_at)}</time></header>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <CardField label="TARGET USER" value={profile?.user_code || row.target_id || "—"} />
        <CardField label="CHANGES" value={formatAuditChanges(row.metadata)} />
        <CardField label="STAFF" value={row.staff_email || "—"} />
        <CardField label="REASON" value={row.reason || "—"} />
      </div>
    </article>
  );
}

function formatAuditChanges(metadata: Record<string, unknown>) {
  const before = metadata["before"];
  const after = metadata["after"];
  if (before !== undefined || after !== undefined) return `${String(before ?? "—")} → ${String(after ?? "—")}`;
  const entries = Object.entries(metadata);
  return entries.length ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "—";
}
