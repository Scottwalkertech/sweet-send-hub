import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — Dynamic Bank of West" },
      { name: "description", content: "Internal administration console." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

const SS_ADMIN = "mt_admin_session";
const LS_USERS = "mt_admin_users";
const LS_QUEUE = "mt_admin_queue";
const LS_BAL = "mt_bal";

type AdminRole = "SuperAdmin" | "Support";
type AdminSession = { email: string; name: string; role: AdminRole };

const ADMIN_ACCOUNTS: Array<{ email: string; password: string; name: string; role: AdminRole }> = [
  { email: "root@dbw.io", password: "Admin2026!", name: "Root Administrator", role: "SuperAdmin" },
  { email: "ops@dbw.io", password: "StaffPass99", name: "Operations Support", role: "Support" },
];

type AccountTier = "Standard" | "Premier" | "Private" | "Business";
type AccountStatus = "Active" | "Frozen" | "Review";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  account: string;
  status: AccountStatus;
  tier: AccountTier;
  balance: number;
};

type PendingTx = {
  id: string;
  userId: string;
  userName: string;
  method: "Wire" | "ACH" | "Check" | "Crypto";
  amount: number;
  submitted: string;
  status: "Pending" | "Approved" | "Failed";
  reference: string;
};

const seedUsers: AdminUser[] = [
  { id: "u_1001", name: "Marcus Whitfield", email: "m.whitfield@dbwest.com", account: "•••• 4419", status: "Active", tier: "Premier", balance: 18420.55 },
  { id: "u_1002", name: "Elena Sokolova", email: "elena.s@dbwest.com", account: "•••• 7832", status: "Active", tier: "Private", balance: 42981.10 },
  { id: "u_1003", name: "David Chen", email: "d.chen@dbwest.com", account: "•••• 2251", status: "Review", tier: "Standard", balance: 3120.00 },
  { id: "u_1004", name: "Priya Nair", email: "p.nair@dbwest.com", account: "•••• 9908", status: "Active", tier: "Business", balance: 76540.22 },
  { id: "u_1005", name: "Jonah Blackwood", email: "j.blackwood@dbwest.com", account: "•••• 1145", status: "Frozen", tier: "Standard", balance: 210.75 },
];

const seedQueue: PendingTx[] = [
  { id: "q_9001", userId: "u_1001", userName: "Marcus Whitfield", method: "Wire", amount: 5000, submitted: "2026-07-02", status: "Pending", reference: "DBW-WIRE-88213" },
  { id: "q_9002", userId: "u_1002", userName: "Elena Sokolova", method: "Crypto", amount: 12500, submitted: "2026-07-02", status: "Pending", reference: "DBW-CRYP-44120" },
  { id: "q_9003", userId: "u_1004", userName: "Priya Nair", method: "Check", amount: 850.42, submitted: "2026-07-01", status: "Pending", reference: "DBW-CHK-30918" },
  { id: "q_9004", userId: "u_1003", userName: "David Chen", method: "ACH", amount: 2200, submitted: "2026-07-01", status: "Pending", reference: "DBW-ACH-71204" },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function AdminPage() {
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(SS_ADMIN);
    if (raw) {
      try { setSession(JSON.parse(raw) as AdminSession); } catch { /* ignore */ }
    }
    setBooted(true);
  }, []);

  function handleLogin(s: AdminSession) {
    sessionStorage.setItem(SS_ADMIN, JSON.stringify(s));
    setSession(s);
  }
  function handleLogout() {
    sessionStorage.removeItem(SS_ADMIN);
    setSession(null);
  }

  if (!booted) return null;
  if (!session) return <AdminGate onPass={handleLogin} />;
  return <AdminConsole session={session} onLogout={handleLogout} />;
}

function AdminGate({ onPass }: { onPass: (s: AdminSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const match = ADMIN_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password,
    );
    if (match) {
      window.dispatchEvent(new Event("ptl:show"));
      setTimeout(() => onPass({ email: match.email, name: match.name, role: match.role }), 900);
    } else {
      setErr("Access denied. Invalid administrator credentials.");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-[#0f1420] p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black">A</div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-400/80">Restricted</div>
            <h1 className="text-lg font-semibold">Administrator Sign-in</h1>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400">Role-based access. Sign in with your administrator email and password.</p>

        <label className="mt-6 block text-xs uppercase tracking-wider text-slate-400">Email</label>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErr(""); }}
          placeholder="you@dbw.io"
          className="mt-2 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
        />

        <label className="mt-4 block text-xs uppercase tracking-wider text-slate-400">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setErr(""); }}
          placeholder="••••••••"
          className="mt-2 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
        />

        {err && <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
        <button type="submit" className="mt-6 w-full rounded-md bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-semibold text-black hover:brightness-110">
          Sign in
        </button>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-slate-500 hover:text-amber-400">← Return to banking portal</Link>
        </div>
        <div className="mt-5 rounded border border-white/5 bg-black/30 p-3 text-[10px] leading-relaxed text-slate-500">
          <div className="uppercase tracking-wider text-slate-400 mb-1">Test accounts</div>
          <div>SuperAdmin — root@dbw.io / Admin2026!</div>
          <div>Support — ops@dbw.io / StaffPass99</div>
        </div>
      </form>
    </div>
  );
}

function AdminConsole({ session, onLogout }: { session: AdminSession; onLogout: () => void }) {
  const canEditBalance = session.role === "SuperAdmin";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [queue, setQueue] = useState<PendingTx[]>([]);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; email: string; tier: AccountTier; status: AccountStatus; balance: string }>({ name: "", email: "", tier: "Standard", status: "Active", balance: "0" });
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{ name: string; email: string; tier: AccountTier; status: AccountStatus; balance: string }>({ name: "", email: "", tier: "Standard", status: "Active", balance: "0" });
  const [createErr, setCreateErr] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const u = localStorage.getItem(LS_USERS);
    const q = localStorage.getItem(LS_QUEUE);
    setUsers(u ? JSON.parse(u) : seedUsers);
    setQueue(q ? JSON.parse(q) : seedQueue);
  }, []);

  function saveUsers(next: AdminUser[]) {
    setUsers(next);
    localStorage.setItem(LS_USERS, JSON.stringify(next));
  }
  function saveQueue(next: PendingTx[]) {
    setQueue(next);
    localStorage.setItem(LS_QUEUE, JSON.stringify(next));
  }
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  function openEdit(u: AdminUser) {
    if (!canEditBalance) {
      flash("Support role cannot edit customer profiles.");
      return;
    }
    setEditing(u);
    setEditForm({ name: u.name, email: u.email, tier: u.tier, status: u.status, balance: u.balance.toFixed(2) });
  }
  function saveEdit() {
    if (!editing || !canEditBalance) return;
    const bal = Number(editForm.balance);
    if (Number.isNaN(bal)) return;
    if (!editForm.name.trim() || !editForm.email.trim()) return;
    const next = users.map((u) =>
      u.id === editing.id
        ? { ...u, name: editForm.name.trim(), email: editForm.email.trim(), tier: editForm.tier, status: editForm.status, balance: bal }
        : u,
    );
    saveUsers(next);
    if (editing.id === "u_1001") localStorage.setItem(LS_BAL, String(bal));
    flash(`Profile updated for ${editForm.name}`);
    setEditing(null);
  }

  function openCreate() {
    if (!canEditBalance) {
      flash("Support role cannot create accounts.");
      return;
    }
    setCreateForm({ name: "", email: "", tier: "Standard", status: "Active", balance: "0" });
    setCreateErr("");
    setCreating(true);
  }
  function saveCreate() {
    if (!canEditBalance) return;
    const name = createForm.name.trim();
    const email = createForm.email.trim();
    const bal = Number(createForm.balance);
    if (!name || !email) { setCreateErr("Full name and email are required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setCreateErr("Enter a valid email address."); return; }
    if (Number.isNaN(bal) || bal < 0) { setCreateErr("Initial balance must be a non-negative number."); return; }
    const id = "u_" + Math.floor(1000 + Math.random() * 9000);
    const mask = "•••• " + String(Math.floor(1000 + Math.random() * 9000));
    const newUser: AdminUser = { id, name, email, account: mask, status: createForm.status, tier: createForm.tier, balance: bal };
    saveUsers([newUser, ...users]);
    flash(`Account created for ${name}`);
    setCreating(false);
  }

  function approve(tx: PendingTx) {
    if (tx.status !== "Pending") return;
    const nextQueue = queue.map((q) => (q.id === tx.id ? { ...q, status: "Approved" as const } : q));
    const nextUsers = users.map((u) => (u.id === tx.userId ? { ...u, balance: u.balance + tx.amount } : u));
    saveQueue(nextQueue);
    saveUsers(nextUsers);
    if (tx.userId === "u_1001") {
      const cur = Number(localStorage.getItem(LS_BAL) ?? "0");
      localStorage.setItem(LS_BAL, String(cur + tx.amount));
    }
    flash(`Approved ${fmt(tx.amount)} for ${tx.userName}`);
  }
  function fail(tx: PendingTx) {
    if (tx.status !== "Pending") return;
    const nextQueue = queue.map((q) => (q.id === tx.id ? { ...q, status: "Failed" as const } : q));
    saveQueue(nextQueue);
    flash(`Marked ${tx.reference} as failed`);
  }

  const pendingCount = queue.filter((q) => q.status === "Pending").length;
  const totalAum = users.reduce((s, u) => s + u.balance, 0);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100">
      {/* Top bar */}
      <header className="border-b border-amber-500/20 bg-[#0f1420]">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black">A</div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">Restricted Console</div>
              <div className="text-sm font-semibold">Dynamic Bank of West · Admin</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-medium text-white">{session.name}</span>
              <span className="text-[10px] text-slate-500">{session.email}</span>
            </div>
            <RoleBadge role={session.role} />
            <Link to="/" className="text-xs text-slate-400 hover:text-amber-400">Portal</Link>
            <button onClick={onLogout} className="rounded border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">Sign out</button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="mx-auto max-w-7xl px-4 pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total Customers" value={String(users.length)} accent="text-amber-400" />
        <Stat label="Assets Under Management" value={fmt(totalAum)} accent="text-emerald-400" />
        <Stat label="Pending Deposits" value={String(pendingCount)} accent="text-cyan-400" />
      </div>

      {/* User Management */}
      <section className="mx-auto max-w-7xl px-4 mt-8">
        <SectionHeader title="User Management" subtitle="View and adjust customer account balances." />
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0f1420]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <Th>Customer</Th>
                  <Th>Account</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Balance</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <Td>
                      <div className="font-medium text-white">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </Td>
                    <Td className="font-mono text-xs text-slate-300">{u.account}</Td>
                    <Td><StatusPill status={u.status} /></Td>
                    <Td className="text-right font-mono text-white">{fmt(u.balance)}</Td>
                    <Td className="text-right">
                      <button
                        onClick={() => openEdit(u)}
                        disabled={!canEditBalance}
                        title={canEditBalance ? "Edit balance" : "Support role cannot edit balances"}
                        className="rounded border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-300 hover:bg-amber-400/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-amber-400/10"
                      >
                        Edit Balance
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Transaction Queue */}
      <section className="mx-auto max-w-7xl px-4 mt-10 pb-16">
        <SectionHeader title="Transaction Queue" subtitle="Pending deposit requests awaiting review." />
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0f1420]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <Th>Reference</Th>
                  <Th>Customer</Th>
                  <Th>Method</Th>
                  <Th>Submitted</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((tx) => (
                  <tr key={tx.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <Td className="font-mono text-xs text-amber-300">{tx.reference}</Td>
                    <Td className="text-white">{tx.userName}</Td>
                    <Td><MethodPill method={tx.method} /></Td>
                    <Td className="text-slate-400 text-xs">{tx.submitted}</Td>
                    <Td className="text-right font-mono text-emerald-300">+{fmt(tx.amount)}</Td>
                    <Td><TxStatus status={tx.status} /></Td>
                    <Td className="text-right">
                      <div className="inline-flex gap-2">
                        <button
                          disabled={tx.status !== "Pending"}
                          onClick={() => approve(tx)}
                          className="rounded border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Approve
                        </button>
                        <button
                          disabled={tx.status !== "Pending"}
                          onClick={() => fail(tx)}
                          className="rounded border border-red-400/40 bg-red-400/10 px-3 py-1 text-xs text-red-300 hover:bg-red-400/20 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Fail
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr><Td className="text-center text-slate-500 py-8">No transactions in queue.</Td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#0f1420] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-400/80">Balance Adjustment</div>
            <h3 className="mt-1 text-lg font-semibold text-white">{editing.name}</h3>
            <div className="text-xs text-slate-400">{editing.account} · Current: {fmt(editing.balance)}</div>
            <label className="mt-5 block text-xs uppercase tracking-wider text-slate-400">New Balance (USD)</label>
            <input
              type="number"
              step="0.01"
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              className="mt-2 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-white focus:border-amber-400 focus:outline-none"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded border border-white/10 px-4 py-2 text-xs hover:bg-white/5">Cancel</button>
              <button onClick={saveEdit} className="rounded bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-xs font-semibold text-black hover:brightness-110">Save Change</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 shadow-lg backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1420] p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function StatusPill({ status }: { status: AdminUser["status"] }) {
  const map = {
    Active: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    Frozen: "border-red-400/40 bg-red-400/10 text-red-300",
    Review: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  } as const;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[status]}`}>{status}</span>;
}

function TxStatus({ status }: { status: PendingTx["status"] }) {
  const map = {
    Pending: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    Approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    Failed: "border-red-400/40 bg-red-400/10 text-red-300",
  } as const;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[status]}`}>{status}</span>;
}

function MethodPill({ method }: { method: PendingTx["method"] }) {
  return <span className="inline-block rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">{method}</span>;
}

function RoleBadge({ role }: { role: AdminRole }) {
  const cls =
    role === "SuperAdmin"
      ? "border-amber-400/50 bg-amber-400/15 text-amber-300"
      : "border-cyan-400/50 bg-cyan-400/10 text-cyan-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {role}
    </span>
  );
}
