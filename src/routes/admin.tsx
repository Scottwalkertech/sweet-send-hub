import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  loadUsers, saveUsers, loadQueue, saveQueue,
  loadDepositSettings, saveDepositSettings,
  loadChatThreads, appendChatMessage,
  appendLedger, upsertUser,
  genAccountNumber, maskAccount, readFileAsDataUrl, fmtCurrency, SECURITY_QUESTIONS,
  type MtUser, type AccountTier, type AccountStatus, type AccountKey, type PendingTx, type DepositSettings, type ChatMessage, type LedgerEntry,
} from "@/lib/mt-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Treasury Management Console — Dynamic Bank of West" },
      { name: "description", content: "Internal Treasury Management & Operations Console." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

const SS_ADMIN = "mt_admin_session";
type AdminRole = "SuperAdmin" | "Support";
type AdminSession = { email: string; name: string; role: AdminRole };

const ADMIN_ACCOUNTS: Array<{ email: string; password: string; name: string; role: AdminRole }> = [
  { email: "root@dbw.io", password: "Admin2026!", name: "Root Administrator", role: "SuperAdmin" },
  { email: "ops@dbw.io", password: "StaffPass99", name: "Operations Support", role: "Support" },
];

function AdminPage() {
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<AdminSession | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem(SS_ADMIN);
    if (raw) { try { setSession(JSON.parse(raw) as AdminSession); } catch { /* */ } }
    setBooted(true);
  }, []);
  function handleLogin(s: AdminSession) { sessionStorage.setItem(SS_ADMIN, JSON.stringify(s)); setSession(s); }
  function handleLogout() { sessionStorage.removeItem(SS_ADMIN); setSession(null); }
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
    const match = ADMIN_ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password);
    if (match) {
      window.dispatchEvent(new Event("ptl:show"));
      setTimeout(() => onPass({ email: match.email, name: match.name, role: match.role }), 700);
    } else setErr("Access denied. Invalid operator credentials.");
  }
  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-[#0f1420] p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black">A</div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-400/80">Restricted</div>
            <h1 className="text-lg font-semibold">Treasury Management Sign-in</h1>
          </div>
        </div>
        <label className="mt-6 block text-xs uppercase tracking-wider text-slate-400">Email</label>
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@dbw.io" className={inputDark} />
        <label className="mt-4 block text-xs uppercase tracking-wider text-slate-400">Password</label>
        <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }} placeholder="••••••••" className={inputDark} />
        {err && <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
        <button type="submit" className="mt-6 w-full rounded-md bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-semibold text-black hover:brightness-110">Sign in</button>
        <div className="mt-4 text-center"><Link to="/" className="text-xs text-slate-500 hover:text-amber-400">← Return to banking portal</Link></div>
        <div className="mt-5 rounded border border-white/5 bg-black/30 p-3 text-[10px] leading-relaxed text-slate-500">
          <div className="uppercase tracking-wider text-slate-400 mb-1">Test accounts</div>
          <div>SuperAdmin — root@dbw.io / Admin2026!</div>
          <div>Support — ops@dbw.io / StaffPass99</div>
        </div>
      </form>
    </div>
  );
}

type EditForm = {
  name: string; email: string; phone: string; ssn: string;
  password: string;
  tier: AccountTier; status: AccountStatus; balance: string; savingsBalance: string;
  securityQ: string; securityA: string;
  profilePicture: string;
  enrollSmallBusiness: boolean; enrollCommercial: boolean; enrollWire: boolean;
  balSmallBusiness: string; balCommercial: string; balWire: string;
};

function emptyForm(): EditForm {
  return {
    name: "", email: "", phone: "", ssn: "", password: "",
    tier: "Standard", status: "Active", balance: "0", savingsBalance: "0",
    securityQ: SECURITY_QUESTIONS[0], securityA: "", profilePicture: "",
    enrollSmallBusiness: false, enrollCommercial: false, enrollWire: false,
    balSmallBusiness: "0", balCommercial: "0", balWire: "0",
  };
}

function AdminConsole({ session, onLogout }: { session: AdminSession; onLogout: () => void }) {
  const canEdit = session.role === "SuperAdmin";
  const [users, setUsers] = useState<MtUser[]>([]);
  const [queue, setQueue] = useState<PendingTx[]>([]);
  const [settings, setSettings] = useState<DepositSettings>(loadDepositSettings());
  const [editing, setEditing] = useState<MtUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm());
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<EditForm>(emptyForm());
  const [modalErr, setModalErr] = useState("");
  const [toast, setToast] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    setUsers(loadUsers());
    setQueue(loadQueue());
    setSettings(loadDepositSettings());
    const refresh = () => { setUsers(loadUsers()); setQueue(loadQueue()); setSettings(loadDepositSettings()); };
    window.addEventListener("mt:users-changed", refresh);
    window.addEventListener("mt:queue-changed", refresh);
    window.addEventListener("mt:deposit-settings-changed", refresh);
    window.addEventListener("storage", refresh);
    const i = setInterval(refresh, 1500);
    return () => {
      window.removeEventListener("mt:users-changed", refresh);
      window.removeEventListener("mt:queue-changed", refresh);
      window.removeEventListener("mt:deposit-settings-changed", refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(i);
    };
  }, []);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(""), 2600); }

  function openEdit(u: MtUser) {
    if (!canEdit) { flash("Support role cannot edit customer profiles."); return; }
    setEditing(u);
    setModalErr("");
    setEditForm({
      name: u.name, email: u.email, phone: u.phone, ssn: u.ssn,
      password: u.password,
      tier: u.tier, status: u.status, balance: u.balance.toFixed(2), savingsBalance: (u.savingsBalance ?? 0).toFixed(2),
      securityQ: u.securityQ, securityA: u.securityA,
      profilePicture: u.profilePicture ?? "",
      enrollSmallBusiness: !!u.enrollments?.smallBusiness,
      enrollCommercial: !!u.enrollments?.commercial,
      enrollWire: !!u.enrollments?.wire,
      balSmallBusiness: (u.serviceBalances?.smallBusiness ?? 0).toFixed(2),
      balCommercial: (u.serviceBalances?.commercial ?? 0).toFixed(2),
      balWire: (u.serviceBalances?.wire ?? 0).toFixed(2),
    });
  }
  function saveEdit() {
    if (!editing || !canEdit) return;
    const bal = Number(editForm.balance);
    if (!editForm.name.trim() || !editForm.email.trim() || Number.isNaN(bal)) { setModalErr("Name, email, and a valid balance are required."); return; }
    const next = users.map((u) => u.id === editing.id ? {
      ...u,
      name: editForm.name.trim(), email: editForm.email.trim(), phone: editForm.phone,
      ssn: editForm.ssn, password: editForm.password || u.password,
      tier: editForm.tier, status: editForm.status, balance: bal, savingsBalance: Number(editForm.savingsBalance) || 0,
      securityQ: editForm.securityQ, securityA: editForm.securityA,
      profilePicture: editForm.profilePicture || undefined,
      enrollments: {
        smallBusiness: editForm.enrollSmallBusiness,
        commercial: editForm.enrollCommercial,
        wire: editForm.enrollWire,
      },
      serviceBalances: {
        smallBusiness: Number(editForm.balSmallBusiness) || 0,
        commercial: Number(editForm.balCommercial) || 0,
        wire: Number(editForm.balWire) || 0,
      },
    } : u);
    saveUsers(next);
    flash(`Profile updated for ${editForm.name}`);
    setEditing(null);
  }
  function openCreate() {
    if (!canEdit) { flash("Support role cannot create accounts."); return; }
    setCreateForm(emptyForm()); setModalErr(""); setCreating(true);
  }
  function saveCreate() {
    if (!canEdit) return;
    const name = createForm.name.trim();
    const email = createForm.email.trim();
    const bal = Number(createForm.balance);
    if (!name || !email) { setModalErr("Full name and email are required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setModalErr("Enter a valid email."); return; }
    if (Number.isNaN(bal) || bal < 0) { setModalErr("Initial balance must be zero or positive."); return; }
    const acctFull = genAccountNumber();
    const newUser: MtUser = {
      id: "u_" + Math.floor(1000 + Math.random() * 9000),
      name, email, password: createForm.password || "password123",
      phone: createForm.phone, ssn: createForm.ssn || "•••-••-••••",
      securityQ: createForm.securityQ, securityA: createForm.securityA.toLowerCase(),
      accountNumber: acctFull, account: maskAccount(acctFull),
      tier: createForm.tier, status: createForm.status, balance: bal,
      savingsBalance: Number(createForm.savingsBalance) || 0, savingsAccountNumber: genAccountNumber(),
      verified: true, profilePicture: createForm.profilePicture || undefined,
      createdAt: new Date().toISOString().slice(0, 10),
      enrollments: {
        smallBusiness: createForm.enrollSmallBusiness,
        commercial: createForm.enrollCommercial,
        wire: createForm.enrollWire,
      },
      serviceBalances: {
        smallBusiness: Number(createForm.balSmallBusiness) || 0,
        commercial: Number(createForm.balCommercial) || 0,
        wire: Number(createForm.balWire) || 0,
      },
    };
    saveUsers([newUser, ...users]);
    flash(`Account created for ${name}`);
    setCreating(false);
  }

  function approve(tx: PendingTx) {
    if (tx.status !== "Pending") return;
    const nextQ = queue.map((q) => q.id === tx.id ? { ...q, status: "Approved" as const, resolvedAt: new Date().toISOString() } : q);
    const delta = tx.direction === "credit" ? tx.amount : -tx.amount;
    const nextU = users.map((u) => u.id === tx.userId ? { ...u, balance: Math.max(0, u.balance + delta) } : u);
    saveQueue(nextQ); saveUsers(nextU);
    flash(`Approved ${fmtCurrency(tx.amount)} for ${tx.userName}`);
  }
  function fail(tx: PendingTx) {
    if (tx.status !== "Pending") return;
    const nextQ = queue.map((q) => q.id === tx.id ? { ...q, status: "Failed" as const, resolvedAt: new Date().toISOString() } : q);
    saveQueue(nextQ);
    flash(`Marked ${tx.reference} as failed`);
  }

  const pendingCount = queue.filter((q) => q.status === "Pending").length;
  const totalAum = users.reduce((s, u) => s + u.balance, 0);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100">
      <header className="border-b border-amber-500/20 bg-[#0f1420]">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black">A</div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">Restricted Console</div>
              <div className="text-sm font-semibold">Dynamic Bank of West · Treasury Management</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-medium text-white">{session.name}</span>
              <span className="text-[10px] text-slate-500">{session.email}</span>
            </div>
            <RoleBadge role={session.role} />
            <Link to="/" className="text-xs text-slate-400 hover:text-amber-400">Portal</Link>
            <button onClick={() => setChatOpen((v) => !v)}
              className="rounded border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-400/20">
              {chatOpen ? "Close Chat" : "Live Chat"}
            </button>
            <button onClick={onLogout} className="rounded border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total Customers" value={String(users.length)} accent="text-amber-400" />
        <Stat label="Assets Under Management" value={fmtCurrency(totalAum)} accent="text-emerald-400" />
        <Stat label="Pending Requests" value={String(pendingCount)} accent="text-cyan-400" />
      </div>

      {/* Global Deposit Settings */}
      <section className="mx-auto max-w-7xl px-4 mt-8">
        <SectionHeader title="Global Deposit Settings" subtitle="Edit the wire instructions and Bitcoin deposit address shown to every customer." />
        <DepositSettingsPanel settings={settings} canEdit={canEdit} onSave={(s) => { saveDepositSettings(s); flash("Deposit settings saved."); }} />
      </section>

      {/* User Management */}
      <section className="mx-auto max-w-7xl px-4 mt-10">
        <div className="flex items-end justify-between gap-4">
          <SectionHeader title="User Management" subtitle="Full override control over every customer profile." />
          <button onClick={openCreate} disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-400/40 bg-gradient-to-b from-emerald-500/20 to-emerald-600/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:from-emerald-500/30 disabled:opacity-30">
            <span className="text-base leading-none">+</span> Create Account
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0f1420]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <Th>Customer</Th><Th>Account</Th><Th>Tier</Th><Th>Status</Th>
                  <Th>Verified</Th><Th className="text-right">Balance</Th><Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <Td>
                      <div className="flex items-center gap-3">
                        {u.profilePicture
                          ? <img src={u.profilePicture} alt="" className="h-9 w-9 rounded-full object-cover border border-white/10" />
                          : <div className="h-9 w-9 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center">{u.name.slice(0, 1)}</div>}
                        <div>
                          <div className="font-medium text-white">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="font-mono text-xs text-slate-300">{u.account}</Td>
                    <Td><TierPill tier={u.tier} /></Td>
                    <Td><StatusPill status={u.status} /></Td>
                    <Td>{u.verified ? <span className="text-emerald-300 text-xs">✓ Verified</span> : <span className="text-amber-300 text-xs">Pending</span>}</Td>
                    <Td className="text-right font-mono text-white">{fmtCurrency(u.balance)}</Td>
                    <Td className="text-right">
                      <button onClick={() => openEdit(u)} disabled={!canEdit}
                        className="rounded border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-300 hover:bg-amber-400/20 disabled:opacity-30">
                        Edit
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Transaction Template Repository (admin-only) */}
      <section className="mx-auto max-w-7xl px-4 mt-10">
        <TemplateRepositoryPanel users={users} canEdit={canEdit} flash={flash} />
      </section>

      {/* Transaction Queue */}
      <section className="mx-auto max-w-7xl px-4 mt-10 pb-16">
        <SectionHeader title="Transaction Queue" subtitle="All customer deposit and transfer requests awaiting review." />
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0f1420]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <Th>Reference</Th><Th>Customer</Th><Th>Method</Th><Th>Direction</Th>
                  <Th>Submitted</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((tx) => (
                  <tr key={tx.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <Td className="font-mono text-xs text-amber-300">{tx.reference}</Td>
                    <Td className="text-white">{tx.userName}</Td>
                    <Td><MethodPill method={tx.method} /></Td>
                    <Td className="text-xs text-slate-400">{tx.direction === "credit" ? "Credit ↓" : "Debit ↑"}</Td>
                    <Td className="text-slate-400 text-xs">{tx.submitted}</Td>
                    <Td className={`text-right font-mono ${tx.direction === "credit" ? "text-emerald-300" : "text-red-300"}`}>{tx.direction === "credit" ? "+" : "-"}{fmtCurrency(tx.amount)}</Td>
                    <Td><TxStatus status={tx.status} /></Td>
                    <Td className="text-right">
                      <div className="inline-flex gap-2">
                        <button disabled={tx.status !== "Pending"} onClick={() => approve(tx)}
                          className="rounded border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-30">Approve</button>
                        <button disabled={tx.status !== "Pending"} onClick={() => fail(tx)}
                          className="rounded border border-red-400/40 bg-red-400/10 px-3 py-1 text-xs text-red-300 hover:bg-red-400/20 disabled:opacity-30">Fail</button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {queue.length === 0 && (<tr><Td className="text-center text-slate-500 py-8">No transactions in queue.</Td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {editing && <UserModal title={`Edit — ${editing.name}`} tone="amber" form={editForm} setForm={setEditForm} err={modalErr} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {creating && <UserModal title="Create Customer Account" tone="emerald" form={createForm} setForm={setCreateForm} err={modalErr} onClose={() => setCreating(false)} onSave={saveCreate} />}

      {chatOpen && <AdminChatPanel users={users} agentName={session.name} onClose={() => setChatOpen(false)} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 shadow-lg backdrop-blur">{toast}</div>
      )}
    </div>
  );
}

function DepositSettingsPanel({ settings, canEdit, onSave }: { settings: DepositSettings; canEdit: boolean; onSave: (s: DepositSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(settings); }, [settings]);

  async function pickQr(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const dataUrl = await readFileAsDataUrl(f);
    setDraft({ ...draft, btcQrDataUrl: dataUrl });
  }

  return (
    <div className="mt-4 grid lg:grid-cols-[1fr_260px] gap-4">
      <div className="rounded-xl border border-white/10 bg-[#0f1420] p-6 grid sm:grid-cols-2 gap-3">
        <DarkField label="Bank name"><input value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} className={inputDark} disabled={!canEdit} /></DarkField>
        <DarkField label="Routing / ABA"><input value={draft.routing} onChange={(e) => setDraft({ ...draft, routing: e.target.value })} className={inputDark} disabled={!canEdit} /></DarkField>
        <DarkField label="Beneficiary"><input value={draft.beneficiary} onChange={(e) => setDraft({ ...draft, beneficiary: e.target.value })} className={inputDark} disabled={!canEdit} /></DarkField>
        <DarkField label="Account number"><input value={draft.accountNumber} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} className={inputDark} disabled={!canEdit} /></DarkField>
        <DarkField label="SWIFT / BIC"><input value={draft.swift} onChange={(e) => setDraft({ ...draft, swift: e.target.value })} className={inputDark} disabled={!canEdit} /></DarkField>
        <DarkField label="Bank address"><input value={draft.bankAddress} onChange={(e) => setDraft({ ...draft, bankAddress: e.target.value })} className={inputDark} disabled={!canEdit} /></DarkField>
        <div className="sm:col-span-2">
          <DarkField label="Bitcoin (BTC) wallet address"><input value={draft.btcAddress} onChange={(e) => setDraft({ ...draft, btcAddress: e.target.value })} className={`${inputDark} font-mono`} disabled={!canEdit} /></DarkField>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button disabled={!canEdit} onClick={() => onSave(draft)} className="rounded bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-xs font-semibold text-black hover:brightness-110 disabled:opacity-30">Save deposit settings</button>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0f1420] p-6 flex flex-col items-center gap-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">BTC QR image</div>
        {draft.btcQrDataUrl
          ? <img src={draft.btcQrDataUrl} alt="BTC QR" className="h-40 w-40 rounded-md object-contain bg-white p-2" />
          : <div className="h-40 w-40 rounded-md border-2 border-dashed border-white/10 flex items-center justify-center text-slate-500 text-xs">No QR uploaded</div>}
        <input ref={fileRef} type="file" accept="image/*" onChange={pickQr} className="hidden" disabled={!canEdit} />
        <button disabled={!canEdit} onClick={() => fileRef.current?.click()} className="w-full rounded border border-white/10 px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-30">Upload QR image</button>
        {draft.btcQrDataUrl && (
          <button disabled={!canEdit} onClick={() => setDraft({ ...draft, btcQrDataUrl: "" })} className="text-[10px] text-red-300 hover:text-red-200">Remove QR</button>
        )}
      </div>
    </div>
  );
}

function UserModal({ title, tone, form, setForm, err, onClose, onSave }: {
  title: string; tone: "amber" | "emerald";
  form: EditForm; setForm: (f: EditForm) => void; err: string;
  onClose: () => void; onSave: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  async function pickPic(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const dataUrl = await readFileAsDataUrl(f);
    setForm({ ...form, profilePicture: dataUrl });
  }
  const borderColor = tone === "amber" ? "border-amber-400/30" : "border-emerald-400/30";
  const btnBg = tone === "amber" ? "from-amber-400 to-amber-600" : "from-emerald-400 to-emerald-600";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className={`w-full max-w-2xl rounded-2xl border ${borderColor} bg-[#0f1420] p-6 shadow-2xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="text-xs uppercase tracking-[0.2em] text-amber-400/80">{title.startsWith("Edit") ? "Edit" : "Create"} Customer Profile</div>
        <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>

        <div className="mt-5 flex items-center gap-4">
          {form.profilePicture
            ? <img src={form.profilePicture} alt="" className="h-16 w-16 rounded-full object-cover border border-white/10" />
            : <div className="h-16 w-16 rounded-full bg-slate-700 text-white text-lg flex items-center justify-center">{(form.name || "?").slice(0, 1)}</div>}
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPic} className="hidden" />
          <div className="flex flex-col gap-1">
            <button onClick={() => fileRef.current?.click()} className="rounded border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">Upload profile picture</button>
            {form.profilePicture && <button onClick={() => setForm({ ...form, profilePicture: "" })} className="text-[10px] text-red-300 hover:text-red-200 text-left">Remove picture</button>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DarkField label="Full Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputDark} /></DarkField>
          <DarkField label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputDark} /></DarkField>
          <DarkField label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputDark} /></DarkField>
          <DarkField label="SSN"><input value={form.ssn} onChange={(e) => setForm({ ...form, ssn: e.target.value })} className={`${inputDark} font-mono`} /></DarkField>
          <DarkField label="Password (login)"><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputDark} placeholder="Leave unchanged" /></DarkField>
          <DarkField label="Checking Balance (USD)"><input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} className={`${inputDark} font-mono`} /></DarkField>
          <DarkField label="Way2Save Savings Balance (USD)"><input type="number" step="0.01" value={form.savingsBalance} onChange={(e) => setForm({ ...form, savingsBalance: e.target.value })} className={`${inputDark} font-mono`} /></DarkField>
          <DarkField label="Tier">
            <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as AccountTier })} className={inputDark}>
              {(["Standard", "Premier", "Private", "Business"] as AccountTier[]).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </DarkField>
          <DarkField label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AccountStatus })} className={inputDark}>
              {(["Active", "Frozen", "Review"] as AccountStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </DarkField>
          <div className="sm:col-span-2">
            <DarkField label="Security question">
              <select value={form.securityQ} onChange={(e) => setForm({ ...form, securityQ: e.target.value })} className={inputDark}>
                {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </DarkField>
          </div>
          <div className="sm:col-span-2">
            <DarkField label="Security answer"><input value={form.securityA} onChange={(e) => setForm({ ...form, securityA: e.target.value })} className={inputDark} /></DarkField>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-amber-400/20 bg-black/30 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80 font-semibold">Service Enrollments</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Toggle to enroll this customer and set a starting balance for each service.</p>
          <div className="mt-3 space-y-2">
            <EnrollRow label="Small Business"
              enrolled={form.enrollSmallBusiness}
              onToggle={(v) => setForm({ ...form, enrollSmallBusiness: v })}
              balance={form.balSmallBusiness}
              onBalance={(b) => setForm({ ...form, balSmallBusiness: b })} />
            <EnrollRow label="Commercial Accounts"
              enrolled={form.enrollCommercial}
              onToggle={(v) => setForm({ ...form, enrollCommercial: v })}
              balance={form.balCommercial}
              onBalance={(b) => setForm({ ...form, balCommercial: b })} />
            <EnrollRow label="Wire Services"
              enrolled={form.enrollWire}
              onToggle={(v) => setForm({ ...form, enrollWire: v })}
              balance={form.balWire}
              onBalance={(b) => setForm({ ...form, balWire: b })} />
          </div>
        </div>


        {err && <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-white/10 px-4 py-2 text-xs hover:bg-white/5">Cancel</button>
          <button onClick={onSave} className={`rounded bg-gradient-to-r ${btnBg} px-4 py-2 text-xs font-semibold text-black hover:brightness-110`}>Save</button>
        </div>
      </div>
    </div>
  );
}

// -- primitives ---------------------------------------------------------------

const inputDark = "mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none";
function DarkField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs uppercase tracking-wider text-slate-400">{label}{children}</label>;
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
    <div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
function TierPill({ tier }: { tier: AccountTier }) {
  const map: Record<AccountTier, string> = {
    Standard: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    Premier: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    Private: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300",
    Business: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
  };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[tier]}`}>{tier}</span>;
}
function StatusPill({ status }: { status: AccountStatus }) {
  const map: Record<AccountStatus, string> = {
    Active: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    Frozen: "border-red-400/40 bg-red-400/10 text-red-300",
    Review: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  };
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
function EnrollRow({ label, enrolled, onToggle, balance, onBalance }: {
  label: string; enrolled: boolean; onToggle: (v: boolean) => void;
  balance: string; onBalance: (b: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
      <label className="inline-flex items-center gap-2 cursor-pointer select-none min-w-[190px]">
        <input type="checkbox" checked={enrolled} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-amber-500" />
        <span className="text-sm text-white">{label}</span>
      </label>
      <span className={`text-[10px] uppercase tracking-wider rounded-full border px-2 py-0.5 ${enrolled ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-slate-500/30 bg-slate-500/10 text-slate-400"}`}>
        {enrolled ? "Enrolled" : "Not enrolled"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Balance</span>
        <input type="number" step="0.01" value={balance} disabled={!enrolled}
          onChange={(e) => onBalance(e.target.value)}
          className="w-32 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs font-mono text-white focus:border-amber-400 focus:outline-none disabled:opacity-40" />
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  const cls = role === "SuperAdmin" ? "border-amber-400/50 bg-amber-400/15 text-amber-300" : "border-cyan-400/50 bg-cyan-400/10 text-cyan-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{role}
    </span>
  );
}

function AdminChatPanel({ users, agentName, onClose }: { users: MtUser[]; agentName: string; onClose: () => void }) {
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  const [activeId, setActiveId] = useState<string | null>(users[0]?.id ?? null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function refresh() { setThreads(loadChatThreads()); }
    refresh();
    window.addEventListener("mt:chat-changed", refresh);
    window.addEventListener("storage", refresh);
    const i = setInterval(refresh, 1200);
    return () => {
      window.removeEventListener("mt:chat-changed", refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(i);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [threads, activeId]);

  function send() {
    const v = text.trim(); if (!v || !activeId) return;
    appendChatMessage(activeId, {
      id: `m_${Date.now()}`, from: "agent", text: v,
      ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
    setText("");
  }

  const activeMsgs = activeId ? (threads[activeId] ?? []) : [];
  const activeUser = users.find((u) => u.id === activeId);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[min(720px,calc(100vw-3rem))] h-[520px] rounded-2xl border border-amber-400/40 bg-[#0f1420] shadow-2xl overflow-hidden flex">
      {/* Thread list */}
      <aside className="w-52 border-r border-white/10 flex flex-col">
        <div className="px-3 py-3 border-b border-white/10 bg-black/40">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-semibold">Live Support</div>
          <div className="text-xs text-slate-300 mt-0.5">Agent: {agentName}</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {users.map((u) => {
            const t = threads[u.id] ?? [];
            const last = t[t.length - 1];
            const active = activeId === u.id;
            return (
              <button key={u.id} onClick={() => setActiveId(u.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-white/5 transition ${active ? "bg-amber-400/10" : "hover:bg-white/[0.03]"}`}>
                <div className="text-xs font-medium text-white truncate">{u.name}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{last ? `${last.from === "agent" ? "You: " : ""}${last.text}` : "No messages yet"}</div>
              </button>
            );
          })}
          {users.length === 0 && <div className="p-4 text-xs text-slate-500">No customers.</div>}
        </div>
      </aside>

      {/* Conversation */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-white/10 bg-black/40 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-semibold">🔒 Secure Channel</div>
            <div className="text-sm font-semibold text-white">{activeUser?.name ?? "Select a customer"}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0a0d14]">
          {activeMsgs.map((m) => (
            <div key={m.id} className={`flex ${m.from === "agent" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.from === "agent" ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black rounded-br-sm" : "bg-white/10 text-slate-100 rounded-bl-sm border border-white/10"}`}>
                <div>{m.text}</div>
                <div className={`text-[10px] mt-1 ${m.from === "agent" ? "text-black/60" : "text-slate-400"}`}>{m.ts}</div>
              </div>
            </div>
          ))}
          {activeMsgs.length === 0 && activeUser && (
            <div className="text-center text-xs text-slate-500 py-10">No messages in this thread yet.</div>
          )}
        </div>
        <div className="border-t border-white/10 p-2 flex items-center gap-2 bg-black/40">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            disabled={!activeId} placeholder="Type as DBW Concierge…"
            className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none disabled:opacity-40" />
          <button onClick={send} disabled={!activeId}
            className="rounded-md bg-gradient-to-r from-amber-400 to-amber-600 text-black text-xs font-bold px-3 py-2 hover:brightness-110 disabled:opacity-40">Send</button>
        </div>
      </div>
    </div>
  );
}

// -- Transaction Template Repository (admin-only injection tools) ------------

type MerchantTemplate = {
  key: string;
  merchant: string;
  category: string;
  descriptions: string[];
  min: number;
  max: number;
};

const MERCHANT_TEMPLATES: MerchantTemplate[] = [
  { key: "starbucks", merchant: "Starbucks", category: "Coffee & Food", descriptions: ["STARBUCKS STORE #4471 SEATTLE WA", "STARBUCKS #22910 LOS ANGELES CA", "STARBUCKS COFFEE #7712"], min: 4.75, max: 18.9 },
  { key: "att", merchant: "AT&T", category: "Telecom", descriptions: ["AT&T *PAYMENT 800-288-2020 TX", "AT&T WIRELESS AUTOPAY"], min: 65, max: 189.4 },
  { key: "verizon", merchant: "Verizon", category: "Telecom", descriptions: ["VERIZON WRLS MYACCT VW", "VZWRLSS*APOCC VISW 800-922-0204"], min: 70, max: 245.75 },
  { key: "walmart", merchant: "Walmart", category: "Retail", descriptions: ["WAL-MART SUPERCENTER #1287", "WMT PURCHASE STORE 3341", "WALMART.COM 800-966-6546 AR"], min: 14.5, max: 312.6 },
  { key: "amazon", merchant: "Amazon", category: "E-commerce", descriptions: ["AMZN Mktp US*RT7Y21P43", "AMAZON.COM*MK9J812TA SEATTLE WA", "AMZN Digital*3H21K4XY2"], min: 8.99, max: 429.15 },
  { key: "nike", merchant: "Nike", category: "Apparel", descriptions: ["NIKE.COM 800-806-6453 OR", "NIKE STORE #0428 BEAVERTON"], min: 45, max: 289.95 },
  { key: "target", merchant: "Target", category: "Retail", descriptions: ["TARGET T-0912 LOS ANGELES", "TARGET.COM * 800-591-3869", "TARGET STORE T-2247"], min: 12.75, max: 267.4 },
  { key: "bestbuy", merchant: "Best Buy", category: "Electronics", descriptions: ["BEST BUY #0428 BURBANK CA", "BESTBUY.COM 888-BESTBUY MN"], min: 24.5, max: 899 },
  { key: "shell", merchant: "Shell", category: "Fuel", descriptions: ["SHELL SERVICE STATION #7118", "SHELL OIL 57544218809 CA"], min: 28.4, max: 92.15 },
  { key: "uber", merchant: "Uber", category: "Rideshare", descriptions: ["UBER *TRIP HELP.UBER.COM CA", "UBER EATS SAN FRANCISCO CA"], min: 6.5, max: 68.9 },
  { key: "netflix", merchant: "Netflix", category: "Subscription", descriptions: ["NETFLIX.COM LOS GATOS CA"], min: 15.49, max: 22.99 },
  { key: "spotify", merchant: "Spotify", category: "Subscription", descriptions: ["SPOTIFY USA NEW YORK NY"], min: 10.99, max: 16.99 },
  { key: "costco", merchant: "Costco", category: "Wholesale", descriptions: ["COSTCO WHSE #0431 LOS ANGELES", "COSTCO GAS #0428"], min: 45, max: 512.8 },
  { key: "cvs", merchant: "CVS Pharmacy", category: "Pharmacy", descriptions: ["CVS/PHARMACY #04128", "CVS 04128 Q03 LOS ANGELES CA"], min: 8.9, max: 142.3 },
  { key: "wholefoods", merchant: "Whole Foods", category: "Grocery", descriptions: ["WHOLEFDS LAB #10221", "WHOLE FOODS MARKET #10221"], min: 22.4, max: 274.6 },
  { key: "chipotle", merchant: "Chipotle", category: "Dining", descriptions: ["CHIPOTLE 0472 LOS ANGELES CA", "CHIPOTLE ONLINE 1800-CHIPOTLE"], min: 11.5, max: 46.9 },
];

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function randChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDateWithinLast30Days(): string {
  const now = Date.now();
  const offsetMs = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
  const d = new Date(now - offsetMs);
  return d.toISOString();
}

function injectMerchantCharge(userId: string, account: AccountKey, description: string, amount: number, dateIso: string): boolean {
  const users = loadUsers();
  const u = users.find((x) => x.id === userId);
  if (!u) return false;
  const current = account === "checking" ? u.balance : u.savingsBalance;
  const newBal = Math.round((current - amount) * 100) / 100;
  const updated: MtUser = account === "checking"
    ? { ...u, balance: newBal }
    : { ...u, savingsBalance: newBal };
  upsertUser(updated);
  const entry: LedgerEntry = {
    id: `led_${Math.random().toString(36).slice(2, 10)}`,
    userId, account, date: dateIso,
    description, amount: -amount, balanceAfter: newBal,
  };
  appendLedger(entry);
  return true;
}

function TemplateRepositoryPanel({ users, canEdit, flash }: { users: MtUser[]; canEdit: boolean; flash: (m: string) => void }) {
  const [targetId, setTargetId] = useState<string>(users[0]?.id ?? "");
  const [account, setAccount] = useState<AccountKey>("checking");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!targetId && users[0]) setTargetId(users[0].id);
  }, [users, targetId]);

  function amountFor(t: MerchantTemplate): number {
    const raw = customAmounts[t.key]?.trim();
    if (raw) {
      const n = Number(raw);
      if (!Number.isNaN(n) && n > 0) return Math.round(n * 100) / 100;
    }
    return rand(t.min, t.max);
  }

  function inject(t: MerchantTemplate) {
    if (!canEdit) { flash("Support role cannot inject ledger entries."); return; }
    if (!targetId) { flash("Select a client profile first."); return; }
    const amt = amountFor(t);
    const desc = randChoice(t.descriptions);
    const ok = injectMerchantCharge(targetId, account, desc, amt, new Date().toISOString());
    if (ok) flash(`Injected ${fmtCurrency(amt)} · ${t.merchant}`);
  }

  function simulateMonthly() {
    if (!canEdit) { flash("Support role cannot run batch simulation."); return; }
    if (!targetId) { flash("Select a client profile first."); return; }
    const count = 5 + Math.floor(Math.random() * 3); // 5–7
    const pool = [...MERCHANT_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, count);
    const batch = pool
      .map((t) => ({ t, amt: amountFor(t), date: randomDateWithinLast30Days(), desc: randChoice(t.descriptions) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const row of batch) {
      injectMerchantCharge(targetId, account, row.desc, row.amt, row.date);
    }
    const total = batch.reduce((s, r) => s + r.amt, 0);
    flash(`Simulated ${batch.length} monthly entries · ${fmtCurrency(total)} total`);
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <SectionHeader title="Transaction Template Repository" subtitle="Internal ledger injection tools. Rows appear as ordinary production entries in the client-facing view." />
        <button
          onClick={simulateMonthly}
          disabled={!canEdit || !targetId}
          className="inline-flex items-center gap-2 rounded-md border border-amber-400/50 bg-gradient-to-b from-amber-400/25 to-amber-600/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-amber-200 hover:from-amber-400/40 disabled:opacity-30"
        >
          ⚡ Simulate Complete Monthly Activity
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-[#0f1420] p-5">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 mb-5">
          <DarkField label="Target Client Profile">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputDark}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.account}</option>)}
            </select>
          </DarkField>
          <DarkField label="Destination Account">
            <select value={account} onChange={(e) => setAccount(e.target.value as AccountKey)} className={inputDark}>
              <option value="checking">Everyday Checking</option>
              <option value="savings">Way2Save Savings</option>
            </select>
          </DarkField>
          <div className="rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] leading-relaxed text-amber-200/80 flex items-center">
            Leave "Custom Amount" blank to use the merchant bracket range. Any numeric value overrides the bracket exactly.
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MERCHANT_TEMPLATES.map((t) => (
            <div key={t.key} className="rounded-lg border border-white/10 bg-black/30 p-3 flex flex-col gap-2 hover:border-amber-400/40 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{t.merchant}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{t.category}</div>
                </div>
                <div className="text-[10px] font-mono text-slate-400 text-right">
                  {fmtCurrency(t.min)}–{fmtCurrency(t.max)}
                </div>
              </div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                Custom Amount ($)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="auto"
                  value={customAmounts[t.key] ?? ""}
                  onChange={(e) => setCustomAmounts({ ...customAmounts, [t.key]: e.target.value })}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-2 py-1.5 text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                />
              </label>
              <button
                onClick={() => inject(t)}
                disabled={!canEdit || !targetId}
                className="mt-1 rounded border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-30"
              >
                Inject Charge
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
